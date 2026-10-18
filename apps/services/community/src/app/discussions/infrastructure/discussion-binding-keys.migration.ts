import { randomUUID } from 'node:crypto';
import {
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';
import { discussionTarget } from '@domains/community';
import { communityDiscussionKey } from '../application/community-discussion-binding';

/** Fence old writers before applying. Historical type interpretation belongs to Wapps. */
export class CommunityDiscussionBindingKeys1792080000000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const name = 'discussion_write_aggregates';
    let table = await runner.getTable(name);
    if (!table) throw new Error('Discussion authority is missing');
    const completed =
      (await runner.hasTable('migrations')) &&
      (
        await runner.query('SELECT id FROM migrations WHERE name = ?', [
          this.constructor.name,
        ])
      ).length > 0;
    if (!table.findColumnByName('bindingKey')) {
      if (completed)
        throw new Error('Completed discussion binding column is missing');
      await runner.addColumn(
        name,
        new TableColumn({
          name: 'bindingKey',
          type: 'varchar',
          length: '256',
          isNullable: true,
          charset: 'ascii',
          collation: 'ascii_bin',
        })
      );
    }
    table = await runner.getTable(name);
    const column = table?.findColumnByName('bindingKey');
    const storage = await runner.query(
      `SELECT c.COLLATION_NAME AS collationName, t.ENGINE AS engine
       FROM information_schema.COLUMNS c JOIN information_schema.TABLES t
         ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
       WHERE c.TABLE_SCHEMA=DATABASE() AND c.TABLE_NAME=? AND c.COLUMN_NAME='bindingKey'`,
      [name]
    );
    if (
      !column ||
      column.type !== 'varchar' ||
      column.length !== '256' ||
      !column.isNullable ||
      storage.length !== 1 ||
      storage[0].collationName !== 'ascii_bin' ||
      storage[0].engine !== 'InnoDB'
    )
      throw new Error('Incompatible discussion binding storage');
    let after = '';
    for (;;) {
      const rows: Array<{ id: string }> = await runner.query(
        `SELECT id FROM ${name} WHERE id > ? ORDER BY id LIMIT 200`,
        [after]
      );
      for (const { id } of rows) {
        await runner.startTransaction();
        try {
          const [row] = await runner.query(
            `SELECT subjectKind, subjectId, bindingKey, revision FROM ${name} WHERE id=? FOR UPDATE`,
            [id]
          );
          if (!row)
            throw new Error(
              'Discussion authority disappeared during migration'
            );
          const expected =
            row.subjectKind === null
              ? null
              : communityDiscussionKey(
                  discussionTarget({ kind: row.subjectKind, id: row.subjectId })
                );
          if (
            row.bindingKey !== expected &&
            (completed || row.bindingKey !== null)
          )
            throw new Error('Conflicting community discussion binding');
          if (row.bindingKey !== expected)
            await runner.query(`UPDATE ${name} SET bindingKey=? WHERE id=?`, [
              expected,
              id,
            ]);
          // Rebuild the disposable representation without changing revisions or request receipts.
          // Reuse the unique revision intent; a migration rerun safely schedules it again.
          if (!completed) {
            const at = Date.now();
            await runner.query(
              `INSERT INTO discussion_outbox (id,discussionId,revision,createdAt,availableAt) VALUES (?,?,?,?,?)
               ON DUPLICATE KEY UPDATE deliveredAt=NULL, availableAt=VALUES(availableAt), lastError=NULL`,
              [randomUUID(), id, row.revision, at, at]
            );
          }
          await runner.commitTransaction();
        } catch (error) {
          await runner.rollbackTransaction();
          throw error;
        }
      }
      if (rows.length < 200) break;
      after = rows[rows.length - 1].id;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Discussion bindings are authoritative; use a reviewed forward migration'
    );
  }
}
