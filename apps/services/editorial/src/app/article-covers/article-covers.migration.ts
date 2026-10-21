import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';
import {
  ARTICLE_COVER_ATTEMPT_LIMIT,
  articleCoverInteger,
  parseArticleCoverUploadReceipt,
} from '@domains/catalog/media';
import {
  ARTICLE_COVER_COMMAND_ATTEMPTS,
  articleCoverFromRow,
  type ArticleCoverRow,
} from './mysql-article-covers';

export class ArticleCovers1791676819000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const completed =
      (await runner.hasTable(history)) &&
      (
        await runner.query(
          `SELECT id FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          ['ArticleCovers1791676819000']
        )
      ).length > 0;
    const string = (
      name: string,
      length: string,
      isPrimary = false,
      isNullable = false
    ) => ({ name, type: 'varchar', length, isPrimary, isNullable });
    const integer = (name: string, isNullable = false) => ({
      name,
      type: 'bigint',
      unsigned: true,
      isNullable,
    });
    const tables = [
      new Table({
        name: 'article_cover_uploads',
        columns: [
          string('id', '36', true),
          string('tenantId', '128'),
          string('ownerIdentityId', '128'),
          string('articleId', '36'),
          string('sourceType', '10'),
          integer('sourceBytes'),
          { name: 'sourceSha256', type: 'char', length: '64' },
          integer('revision'),
          string('status', '9'),
          integer('createdAt'),
          integer('expiresAt'),
          { name: 'asset', type: 'json', isNullable: true },
          { name: 'attempts', type: 'int', unsigned: true },
          { name: 'leaseToken', type: 'char', length: '64', isNullable: true },
          integer('leaseUntil', true),
          string('commandKey', '128', false, true),
        ],
        indices: [
          {
            name: 'idx_article_cover_owner',
            columnNames: ['tenantId', 'ownerIdentityId', 'createdAt'],
          },
          { name: 'idx_article_cover_draft', columnNames: ['articleId'] },
          {
            name: 'idx_article_cover_expiry',
            columnNames: ['status', 'expiresAt'],
          },
        ],
      }),
      new Table({
        name: 'article_cover_commands',
        columns: [
          string('tenantId', '128', true),
          string('ownerIdentityId', '128', true),
          string('commandKey', '128', true),
          string('imageId', '36'),
          { name: 'fingerprint', type: 'char', length: '64' },
          { name: 'receipt', type: 'json', isNullable: true },
          { name: 'executions', type: 'int', unsigned: true },
          integer('createdAt'),
          integer('completedAt', true),
        ],
        indices: [
          {
            name: 'idx_article_cover_command_target',
            columnNames: ['imageId'],
          },
        ],
      }),
    ];
    for (const table of tables) {
      table.engine = 'InnoDB';
      for (const column of table.columns)
        if (['varchar', 'char'].includes(column.type)) {
          column.charset = 'utf8mb4';
          column.collation = 'utf8mb4_bin';
        }
      if (!(await runner.hasTable(table.name))) {
        if (completed)
          throw new Error(
            `Completed article cover schema is missing: ${table.name}`
          );
        await runner.createTable(table);
      }
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
      if (
        storage?.engine !== 'InnoDB' ||
        !actual ||
        actual.columns.length !== table.columns.length ||
        JSON.stringify(keys.map((key) => key.name)) !==
          JSON.stringify(table.primaryColumns.map((column) => column.name)) ||
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
        }) ||
        table.indices.some(
          (expected) =>
            !actual.indices.some(
              (index) =>
                index.name === expected.name &&
                !index.isUnique &&
                JSON.stringify(index.columnNames) ===
                  JSON.stringify(expected.columnNames)
            )
        )
      )
        throw new Error(`Incompatible article cover schema: ${table.name}`);
    }
    let cursor = '';
    for (;;) {
      const rows: ArticleCoverRow[] = await runner.query(
        'SELECT * FROM article_cover_uploads WHERE id > ? ORDER BY id LIMIT 200',
        [cursor]
      );
      for (const row of rows) {
        const upload = articleCoverFromRow(row);
        if (
          !row.tenantId.trim() ||
          row.tenantId.trim() !== row.tenantId ||
          !row.ownerIdentityId.trim() ||
          row.ownerIdentityId.trim() !== row.ownerIdentityId ||
          !Number.isInteger(row.attempts) ||
          row.attempts < 0 ||
          row.attempts > ARTICLE_COVER_ATTEMPT_LIMIT ||
          (row.leaseToken === null) !== (row.leaseUntil === null) ||
          (row.leaseToken === null) !== (row.commandKey === null) ||
          (row.leaseToken !== null &&
            (!/^[0-9a-f]{64}$/.test(row.leaseToken) ||
              !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey ?? '') ||
              upload.status !== 'pending' ||
              row.attempts === 0 ||
              Number(row.leaseUntil) > upload.expiresAt ||
              Number(row.leaseUntil) < upload.createdAt)) ||
          (upload.status === 'ready' && row.attempts === 0) ||
          (upload.status === 'pending'
            ? upload.revision !== 1
            : upload.status === 'ready'
            ? upload.revision !== 2
            : ![2, 3].includes(upload.revision) ||
              (upload.revision === 3 && row.attempts === 0))
        )
          throw new Error(
            'Invalid article cover ownership, revision or processing lease'
          );
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].id;
    }
    let commandCursor = ['', '', ''];
    for (;;) {
      const rows = await runner.query(
        'SELECT * FROM article_cover_commands WHERE (tenantId, ownerIdentityId, commandKey) > (?, ?, ?) ORDER BY tenantId, ownerIdentityId, commandKey LIMIT 200',
        commandCursor
      );
      for (const row of rows) {
        articleCoverInteger(Number(row.createdAt), 8_640_000_000_000_000);
        if (
          !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey) ||
          !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
          !Number.isInteger(row.executions) ||
          row.executions < 0 ||
          row.executions > ARTICLE_COVER_COMMAND_ATTEMPTS ||
          (row.receipt === null) !== (row.completedAt === null) ||
          (row.receipt === null && row.executions === 0)
        )
          throw new Error('Invalid article cover command');
        if (row.receipt !== null) {
          const receipt = parseArticleCoverUploadReceipt(
            typeof row.receipt === 'string'
              ? JSON.parse(row.receipt)
              : row.receipt
          );
          const completedAt = articleCoverInteger(
            Number(row.completedAt),
            8_640_000_000_000_000
          );
          if (
            receipt.id !== row.imageId ||
            completedAt < Number(row.createdAt) ||
            (receipt.status === 'pending'
              ? receipt.revision !== 1 || row.executions !== 0
              : receipt.status === 'ready'
              ? receipt.revision !== 2 || row.executions === 0
              : ![2, 3].includes(receipt.revision) || row.executions !== 0)
          )
            throw new Error('Invalid article cover receipt');
        }
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      commandCursor = [last.tenantId, last.ownerIdentityId, last.commandKey];
    }
    const orphan = await runner.query(
      `SELECT i.id FROM article_cover_uploads i LEFT JOIN article_drafts d ON d.id = i.articleId AND d.tenantId = i.tenantId AND d.ownerIdentityId = i.ownerIdentityId WHERE d.id IS NULL LIMIT 1`
    );
    const receipts = await runner.query(
      `SELECT c.imageId FROM article_cover_commands c LEFT JOIN article_cover_uploads i ON i.id = c.imageId AND i.tenantId = c.tenantId AND i.ownerIdentityId = c.ownerIdentityId WHERE i.id IS NULL OR c.createdAt < i.createdAt OR (c.receipt IS NOT NULL AND CAST(JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.revision')) AS UNSIGNED) > i.revision) LIMIT 1`
    );
    const leases = await runner.query(
      `SELECT i.id FROM article_cover_uploads i LEFT JOIN article_cover_commands c ON c.tenantId = i.tenantId AND c.ownerIdentityId = i.ownerIdentityId AND c.commandKey = i.commandKey WHERE i.leaseToken IS NOT NULL AND (c.imageId IS NULL OR c.imageId <> i.id OR c.receipt IS NOT NULL OR c.executions = 0) LIMIT 1`
    );
    const attempts = await runner.query(
      `SELECT i.id FROM article_cover_uploads i LEFT JOIN (SELECT imageId, SUM(executions) AS total FROM article_cover_commands GROUP BY imageId) c ON c.imageId = i.id WHERE c.total IS NULL OR c.total <> i.attempts LIMIT 1`
    );
    const ready =
      await runner.query(`SELECT i.id FROM article_cover_uploads i WHERE i.status = 'ready' AND NOT EXISTS (
      SELECT 1 FROM article_cover_commands c WHERE c.imageId = i.id AND c.tenantId = i.tenantId AND c.ownerIdentityId = i.ownerIdentityId
      AND JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.status')) = 'ready' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.revision')) AS UNSIGNED) = i.revision
    ) LIMIT 1`);
    if (
      orphan.length ||
      receipts.length ||
      leases.length ||
      attempts.length ||
      ready.length
    )
      throw new Error(
        'Invalid article cover draft, receipt or lease relationships'
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Article covers and receipts are authoritative; use a reviewed data-preserving migration'
    );
  }
}
