import { includeClassificationColumn } from '../content-classification/content-classification-schema';
import {
  applicationDraftId,
  applicationDraftRevision,
  parseApplicationDraft,
} from '@domains/catalog/record';
import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';

export class ApplicationDrafts1791676810000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const scope = [
      { name: 'tenantId', type: 'varchar', length: '128', isPrimary: true },
      {
        name: 'ownerIdentityId',
        type: 'varchar',
        length: '128',
        isPrimary: true,
      },
    ];
    const tables = [
      new Table({ name: 'application_workspaces', columns: scope }),
      new Table({
        name: 'application_drafts',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          ...scope.map((column) => ({ ...column, isPrimary: false })),
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'slug', type: 'varchar', length: '80' },
          { name: 'website', type: 'varchar', length: '2048' },
          { name: 'description', type: 'text' },
          { name: 'revision', type: 'bigint', unsigned: true },
          { name: 'createdAt', type: 'bigint', unsigned: true },
          { name: 'updatedAt', type: 'bigint', unsigned: true },
          {
            name: 'deletedAt',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'idx_application_draft_owner',
            columnNames: [
              'tenantId',
              'ownerIdentityId',
              'deletedAt',
              'updatedAt',
            ],
          },
        ],
      }),
      new Table({
        name: 'application_draft_commands',
        columns: [
          ...scope,
          {
            name: 'commandKey',
            type: 'varchar',
            length: '128',
            isPrimary: true,
          },
          { name: 'fingerprint', type: 'char', length: '64' },
          { name: 'draftId', type: 'varchar', length: '36' },
          { name: 'revision', type: 'bigint', unsigned: true },
          { name: 'deleted', type: 'tinyint' },
          { name: 'createdAt', type: 'bigint', unsigned: true },
        ],
      }),
    ];
    for (const table of tables) {
      table.engine = 'InnoDB';
      for (const column of table.columns) {
        if (['varchar', 'char', 'text'].includes(column.type)) {
          column.charset = 'utf8mb4';
          column.collation = 'utf8mb4_bin';
        }
      }
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
      const [storage] = await runner.query(
        'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
      if (storage?.engine !== 'InnoDB')
        throw new Error(
          `Application draft storage must be transactional: ${table.name}`
        );
      const actual = await runner.getTable(table.name);
      includeClassificationColumn(table, actual);
      // TypeORM omits charset/collation when they equal the database defaults.
      const physical: { name: string; collation: string | null }[] =
        await runner.query(
          'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [table.name]
        );
      if (
        !actual ||
        actual.columns.length !== table.columns.length ||
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
              physical.find((item) => item.name === expected.name)
                ?.collation !== expected.collation)
          );
        })
      )
        throw new Error(`Incompatible application draft schema: ${table.name}`);
      const keys = await runner.query(
        "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
        [table.name]
      );
      if (
        JSON.stringify(keys.map((row: { name: string }) => row.name)) !==
        JSON.stringify(table.primaryColumns.map((column) => column.name))
      )
        throw new Error(
          `Incompatible application draft primary key: ${table.name}`
        );
    }
    let cursor = '';
    for (;;) {
      const rows = await runner.query(
        'SELECT * FROM application_drafts WHERE id > ? ORDER BY id LIMIT 200',
        [cursor]
      );
      for (const row of rows) {
        const id = applicationDraftId(row.id);
        if (!row.tenantId.trim() || !row.ownerIdentityId.trim())
          throw new Error('Invalid application draft ownership');
        applicationDraftRevision(Number(row.revision));
        const createdAt = applicationDraftRevision(Number(row.createdAt));
        const updatedAt = applicationDraftRevision(Number(row.updatedAt));
        if (createdAt > updatedAt || updatedAt > 8_640_000_000_000_000)
          throw new Error('Invalid application draft timestamps');
        if (row.deletedAt === null) {
          parseApplicationDraft({
            id,
            name: row.name,
            slug: row.slug,
            website: row.website,
            description: row.description,
            revision: Number(row.revision),
            createdAt: Number(row.createdAt),
            updatedAt: Number(row.updatedAt),
          });
        } else if (
          row.name !== '' ||
          row.slug !== '' ||
          row.website !== '' ||
          row.description !== '' ||
          !Number.isSafeInteger(Number(row.deletedAt)) ||
          Number(row.deletedAt) !== Number(row.updatedAt) ||
          Number(row.createdAt) < 1 ||
          Number(row.updatedAt) < Number(row.createdAt)
        ) {
          throw new Error('Invalid application draft tombstone');
        }
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].id;
    }
    let receiptCursor: [string, string, string] = ['', '', ''];
    for (;;) {
      const rows = await runner.query(
        'SELECT * FROM application_draft_commands WHERE (tenantId, ownerIdentityId, commandKey) > (?, ?, ?) ORDER BY tenantId, ownerIdentityId, commandKey LIMIT 200',
        receiptCursor
      );
      for (const row of rows) {
        applicationDraftId(row.draftId);
        applicationDraftRevision(Number(row.revision));
        const at = applicationDraftRevision(Number(row.createdAt));
        if (
          !row.tenantId.trim() ||
          !row.ownerIdentityId.trim() ||
          !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey) ||
          !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
          at > 8_640_000_000_000_000
        )
          throw new Error('Invalid application draft receipt');
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      receiptCursor = [last.tenantId, last.ownerIdentityId, last.commandKey];
    }
    const duplicates = await runner.query(
      'SELECT tenantId FROM application_drafts WHERE deletedAt IS NULL GROUP BY tenantId, ownerIdentityId, slug HAVING COUNT(*) > 1 LIMIT 1'
    );
    if (duplicates.length) throw new Error('Duplicate application draft slugs');
    const capacity = await runner.query(
      'SELECT tenantId FROM application_drafts WHERE deletedAt IS NULL GROUP BY tenantId, ownerIdentityId HAVING COUNT(*) > 100 LIMIT 1'
    );
    const orphan = await runner.query(
      'SELECT s.id FROM application_drafts s LEFT JOIN application_workspaces w ON w.tenantId = s.tenantId AND w.ownerIdentityId = s.ownerIdentityId WHERE w.ownerIdentityId IS NULL LIMIT 1'
    );
    const receipts = await runner.query(
      'SELECT c.draftId FROM application_draft_commands c LEFT JOIN application_drafts s ON s.id = c.draftId AND s.tenantId = c.tenantId AND s.ownerIdentityId = c.ownerIdentityId WHERE s.id IS NULL OR c.revision < 1 OR c.revision > s.revision OR c.deleted NOT IN (0,1) OR c.createdAt < s.createdAt OR c.createdAt > s.updatedAt OR (c.deleted = 1 AND (s.deletedAt IS NULL OR c.revision <> s.revision)) LIMIT 1'
    );
    if (capacity.length || orphan.length || receipts.length)
      throw new Error(
        'Invalid application draft capacity, ownership or receipt relationships'
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Application drafts and receipts are authoritative; use a reviewed data-preserving migration'
    );
  }
}
