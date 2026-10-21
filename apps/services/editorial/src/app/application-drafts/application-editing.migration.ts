import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';
import {
  applicationDraftId,
  applicationDraftRevision,
} from '@domains/catalog/record';

/** Private identities remain separate from the canonical applications they propose to edit. */
export class ApplicationEditing1791676813000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const table = new Table({
      name: 'application_editing_targets',
      engine: 'InnoDB',
      columns: [
        { name: 'draftId', type: 'varchar', length: '36', isPrimary: true },
        { name: 'applicationId', type: 'varchar', length: '36' },
        { name: 'claimId', type: 'varchar', length: '36' },
        { name: 'sourcePublicationRevision', type: 'bigint', unsigned: true },
      ],
      indices: [
        {
          name: 'idx_application_editing_target',
          columnNames: ['applicationId', 'draftId'],
        },
      ],
    });
    for (const column of table.columns)
      if (column.type === 'varchar') {
        column.charset = 'utf8mb4';
        column.collation = 'utf8mb4_bin';
      }
    if (!(await runner.hasTable(table.name))) await runner.createTable(table);
    const actual = await runner.getTable(table.name);
    const [storage] = await runner.query(
      'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table.name]
    );
    const physical: { name: string; collation: string | null }[] =
      await runner.query(
        'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
    const keys: { name: string }[] = await runner.query(
      "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
      [table.name]
    );
    const targetIndex: {
      name: string;
      prefix: number | null;
      nonUnique: number;
      direction: string;
      visible: string;
      expression: string | null;
    }[] = await runner.query(
      'SELECT COLUMN_NAME AS name,SUB_PART AS prefix,NON_UNIQUE AS nonUnique,COLLATION AS direction,IS_VISIBLE AS visible,EXPRESSION AS expression FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX',
      [table.name, 'idx_application_editing_target']
    );
    if (
      !actual ||
      storage?.engine !== 'InnoDB' ||
      actual.columns.length !== table.columns.length ||
      JSON.stringify(keys.map((row) => row.name)) !==
        JSON.stringify(['draftId']) ||
      table.columns.some((expected) => {
        const column = actual.columns.find(
          (item) => item.name === expected.name
        );
        return (
          !column ||
          column.type !== expected.type ||
          column.length !== expected.length ||
          column.isNullable !== expected.isNullable ||
          column.isPrimary !== expected.isPrimary ||
          column.unsigned !== expected.unsigned ||
          (expected.collation &&
            physical.find((item) => item.name === expected.name)?.collation !==
              expected.collation)
        );
      }) ||
      // TypeORM's index-column array does not establish physical key order.
      JSON.stringify(targetIndex.map((row) => row.name)) !==
        JSON.stringify(['applicationId', 'draftId']) ||
      targetIndex.some(
        (row) =>
          row.prefix !== null ||
          Number(row.nonUnique) !== 1 ||
          row.direction !== 'A' ||
          row.visible !== 'YES' ||
          row.expression !== null
      )
    )
      throw new Error('Incompatible application editing target schema');
    let cursor: string | null = null;
    for (;;) {
      const rows: {
        draftId: string;
        applicationId: string;
        claimId: string;
        sourcePublicationRevision: string | number;
      }[] = await runner.query(
        'SELECT * FROM application_editing_targets' +
          (cursor ? ' WHERE draftId > ?' : '') +
          ' ORDER BY draftId LIMIT 200',
        cursor ? [cursor] : []
      );
      for (const row of rows) {
        applicationDraftId(row.draftId);
        applicationDraftId(row.applicationId);
        applicationDraftId(row.claimId);
        applicationDraftRevision(Number(row.sourcePublicationRevision));
        if (row.draftId === row.applicationId)
          throw new Error(
            'Editing drafts must have a separate private identity'
          );
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].draftId;
    }
    const invalid =
      await runner.query(`SELECT t.draftId FROM application_editing_targets t
      LEFT JOIN application_drafts p ON p.id = t.draftId
      LEFT JOIN application_ownership_claims c ON c.id = t.claimId
      LEFT JOIN editorial_resource_states e ON e.resourceKind = 'app' AND e.resourceId = t.applicationId
      LEFT JOIN application_ownership_decisions d ON d.claimId = c.id AND d.action = 'approve'
      WHERE p.id IS NULL OR c.id IS NULL OR e.resourceId IS NULL OR d.claimId IS NULL
      OR c.applicationId <> t.applicationId OR p.tenantId <> c.tenantId OR e.tenantId <> c.tenantId
      OR p.ownerIdentityId <> c.claimantIdentityId OR c.status NOT IN ('approved', 'revoked')
      OR t.sourcePublicationRevision < d.applicationRevision OR t.sourcePublicationRevision > e.revision LIMIT 1`);
    if (invalid.length)
      throw new Error(
        'Invalid application editing authority relationships; repair explicitly'
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Editing targets bind authoritative private drafts to ownership grants; use a reviewed data-preserving migration'
    );
  }
}
