import { type MigrationInterface, type QueryRunner } from 'typeorm';
import { suiteId, suiteRevision } from '@domains/publication/suite';
import { isEditorialScope } from '../application/editorial-materialization';
import { suiteSubmissionFromRow } from './mysql-suite-publication';
import { editorialAuthorErasureApplied } from '../account-erasure/editorial-erasure-schema';
import { suitePublicationFields } from './suite-publication-fields';
import { SuitePublication1791676809000 } from './suite-publication.migration';

type Row = Record<string, unknown>;
const fields = [
  [
    'title',
    'varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin',
    'varchar',
    '100',
  ],
  ['description', 'text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin', 'text', ''],
  ['applicationIds', 'json', 'json', ''],
] as const;

/** Freeze approved public bytes before private workspace/history can be erased. */
export class SuitePublicationSnapshots1791840009000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    for (const name of [
      'editorial_resource_states',
      'private_suites',
      'suite_workspaces',
      'suite_submissions',
      'suite_publication_commands',
    ])
      if (!(await runner.hasTable(name)))
        throw new Error('Missing suite publication migration authority');
    const applied =
      (await runner.hasTable('editorial_migrations')) &&
      (
        await runner.query(
          "SELECT 1 FROM editorial_migrations WHERE name='SuitePublicationSnapshots1791840009000' LIMIT 1"
        )
      ).length > 0;
    const table = await runner.getTable('suite_publications');
    const [storage]: Row[] = await runner.query(
      "SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suite_publications'"
    );
    if (!table || storage?.engine !== 'InnoDB')
      throw new Error('Missing transactional suite publication authority');
    const physical: Row[] = await runner.query(
      "SELECT COLUMN_NAME AS name,COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suite_publications'"
    );
    const names = [
      'suiteId',
      'submittedRevision',
      'publishedAt',
      ...fields.map(([name]) => name),
      'classification',
    ];
    if (
      table.columns.some((column) => !names.includes(column.name)) ||
      table.primaryColumns.map((column) => column.name).join(',') !== 'suiteId'
    )
      throw new Error('Incompatible suite publication snapshot schema');
    for (const [name, type, length] of [
      ['suiteId', 'varchar', '36'],
      ['submittedRevision', 'bigint', ''],
      ['publishedAt', 'bigint', ''],
    ]) {
      const column = table.findColumnByName(name);
      if (
        !column ||
        column.type !== type ||
        column.length !== length ||
        column.isNullable ||
        column.unsigned !== (type === 'bigint') ||
        (type === 'varchar' &&
          physical.find((item) => item.name === name)?.collation !==
            'utf8mb4_bin')
      )
        throw new Error('Incompatible suite publication snapshot base');
    }
    for (const [name, , type, length] of fields) {
      const column = table.findColumnByName(name);
      if (!column) {
        if (applied)
          throw new Error(
            'Applied suite publication snapshot column is missing'
          );
        continue;
      }
      if (
        column.type !== type ||
        column.length !== length ||
        column.isPrimary ||
        (applied && column.isNullable) ||
        (type !== 'json' &&
          physical.find((item) => item.name === name)?.collation !==
            'utf8mb4_bin')
      )
        throw new Error('Incompatible suite publication snapshot column');
    }
    if (!applied) {
      // Validate every old pointer before nontransactional DDL; never invent an approved version.
      for await (const rows of this.pages(runner))
        for (const row of rows) await this.approved(runner, row);
      for (const [name, definition] of fields)
        if (!table.findColumnByName(name))
          await runner.query(
            `ALTER TABLE suite_publications ADD COLUMN ${name} ${definition} NULL`
          );
      for await (const rows of this.pages(runner)) {
        await runner.startTransaction();
        try {
          for (const row of rows) {
            const approved = await this.approved(runner, row);
            if (row.title !== null) continue;
            const result = await runner.query(
              'UPDATE suite_publications SET title=?,description=?,applicationIds=? WHERE suiteId=? AND submittedRevision=? AND title IS NULL AND description IS NULL AND applicationIds IS NULL',
              [
                approved.title,
                approved.description,
                JSON.stringify(approved.applicationIds),
                row.suiteId,
                row.submittedRevision,
              ]
            );
            if (result.affectedRows !== 1)
              throw new Error('Suite publication changed during migration');
          }
          await runner.commitTransaction();
        } catch (error) {
          await runner.rollbackTransaction();
          throw error;
        }
      }
      await runner.query(
        `ALTER TABLE suite_publications ${fields
          .map(([name, definition]) => `MODIFY ${name} ${definition} NOT NULL`)
          .join(', ')}`
      );
    }
    await new SuitePublication1791676809000().up(runner, true);
    for await (const rows of this.pages(runner)) {
      for (const row of rows) {
        suiteId(row.suiteId);
        suiteRevision(Number(row.submittedRevision));
        const at = Number(row.publishedAt);
        if (row.publishedAt === null || !Number.isSafeInteger(at) || at < 0)
          throw new Error('Invalid suite publication snapshot time');
        suitePublicationFields(row);
        const [state]: Row[] = await runner.query(
          "SELECT tenantId,ownerIdentityId,revision,deletedAt FROM editorial_resource_states WHERE resourceKind='suite' AND resourceId=?",
          [row.suiteId]
        );
        if (
          !state ||
          !isEditorialScope(state.tenantId) ||
          !(
            isEditorialScope(state.ownerIdentityId) ||
            (state.ownerIdentityId === null &&
              (await editorialAuthorErasureApplied(runner)))
          )
        )
          throw new Error('Missing suite publication snapshot authority');
        suiteRevision(Number(state.revision));
        if (
          state.deletedAt !== null &&
          (!Number.isSafeInteger(Number(state.deletedAt)) ||
            Number(state.deletedAt) < at)
        )
          throw new Error('Invalid suite publication snapshot lifecycle');
      }
    }
  }

  private async approved(runner: QueryRunner, row: Row) {
    const [source]: Row[] = await runner.query(
      `SELECT s.*,d.tenantId AS draftTenant,d.ownerIdentityId AS draftOwner,d.deletedAt AS draftDeletedAt,d.revision AS draftRevision,
       e.tenantId AS publicTenant,e.ownerIdentityId AS publicOwner
       FROM suite_submissions s JOIN private_suites d ON d.id=s.suiteId
       JOIN editorial_resource_states e ON e.resourceKind='suite' AND e.resourceId=s.suiteId
       WHERE s.suiteId=? AND s.submittedRevision=?`,
      [row.suiteId, row.submittedRevision]
    );
    if (
      !source ||
      source.status !== 'approved' ||
      !isEditorialScope(source.tenantId) ||
      !isEditorialScope(source.ownerIdentityId) ||
      !isEditorialScope(source.reviewerIdentityId) ||
      source.reviewerIdentityId === source.ownerIdentityId ||
      source.draftDeletedAt !== null ||
      source.tenantId !== source.draftTenant ||
      source.ownerIdentityId !== source.draftOwner ||
      source.tenantId !== source.publicTenant ||
      source.ownerIdentityId !== source.publicOwner
    )
      throw new Error('Suite publication has no exact approved source');
    suiteId(row.suiteId);
    const submission = suiteSubmissionFromRow(source);
    if (
      submission.submittedRevision !==
        suiteRevision(Number(row.submittedRevision)) ||
      submission.submittedRevision >=
        suiteRevision(Number(source.draftRevision)) ||
      row.publishedAt === null ||
      Number(row.publishedAt) !== submission.reviewedAt
    )
      throw new Error(
        'Suite publication differs from approved revision or time'
      );
    const content = suitePublicationFields(source);
    const present = fields.filter(
      ([name]) => row[name] !== undefined && row[name] !== null
    );
    if (
      present.length &&
      (present.length !== fields.length ||
        JSON.stringify(suitePublicationFields(row)) !== JSON.stringify(content))
    )
      throw new Error(
        'Partially migrated suite publication differs from approval'
      );
    return content;
  }

  private async *pages(runner: QueryRunner): AsyncIterable<Row[]> {
    let after = '';
    for (;;) {
      const rows: Row[] = await runner.query(
        'SELECT * FROM suite_publications WHERE suiteId>? ORDER BY suiteId LIMIT 128',
        [after]
      );
      if (!rows.length) return;
      yield rows;
      after = suiteId(rows[rows.length - 1].suiteId);
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Public suite snapshots are authoritative; use a reviewed data-preserving migration'
    );
  }
}
