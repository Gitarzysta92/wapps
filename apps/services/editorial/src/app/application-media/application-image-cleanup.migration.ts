import { editorialMediaAssetsApplied } from './editorial-media-assets';
import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';
import { APPLICATION_IMAGE_UNUSED_LIFETIME } from '@domains/catalog/media';
import { APPLICATION_IMAGE_REFERENCE_TABLES } from './application-image-retirement';
import {
  validateApplicationImageCleanup,
  type ApplicationImageCleanupRow,
} from './mysql-application-image-cleanup';

export class ApplicationImageCleanup1791676816000
  implements MigrationInterface
{
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
          ['ApplicationImageCleanup1791676816000']
        )
      ).length > 0;
    const number = (name: string, isNullable = false) => ({
      name,
      type: 'bigint',
      unsigned: true,
      isNullable,
    });
    const table = new Table({
      name: 'application_image_cleanup',
      engine: 'InnoDB',
      columns: [
        { name: 'imageId', type: 'varchar', length: '36', isPrimary: true },
        { name: 'reason', type: 'varchar', length: '16' },
        number('createdAt'),
        number('availableAt'),
        { name: 'attempts', type: 'int', unsigned: true },
        { name: 'leaseToken', type: 'char', length: '64', isNullable: true },
        number('leaseUntil', true),
        number('completedAt', true),
        number('failedAt', true),
        { name: 'lastError', type: 'varchar', length: '64', isNullable: true },
      ],
      indices: [
        {
          name: 'idx_application_image_cleanup_pending',
          columnNames: ['completedAt', 'failedAt', 'availableAt'],
        },
      ],
    });
    for (const column of table.columns)
      if (['varchar', 'char'].includes(column.type)) {
        column.charset = 'utf8mb4';
        column.collation = 'utf8mb4_bin';
      }
    if (!(await runner.hasTable(table.name))) {
      if (completed)
        throw new Error(
          'Completed application image cleanup schema is missing'
        );
      await runner.createTable(table);
    }
    const actual = await runner.getTable(table.name);
    const [storage] = await runner.query(
      'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table.name]
    );
    const physical: {
      name: string;
      collation: string | null;
      length: number | null;
    }[] = await runner.query(
      'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation, CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table.name]
    );
    const keys: { name: string }[] = await runner.query(
      "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
      [table.name]
    );
    if (
      !actual ||
      storage?.engine !== 'InnoDB' ||
      actual.columns.length !== table.columns.length ||
      JSON.stringify(keys.map((key) => key.name)) !==
        JSON.stringify(['imageId']) ||
      table.columns.some((expected) => {
        const column = actual.columns.find(
          (item) => item.name === expected.name
        );
        const definition = physical.find((item) => item.name === expected.name);
        return (
          !column ||
          column.type !== expected.type ||
          column.isNullable !== expected.isNullable ||
          column.unsigned !== expected.unsigned ||
          column.isPrimary !== expected.isPrimary ||
          (expected.collation
            ? definition?.collation !== expected.collation ||
              String(definition?.length) !== expected.length
            : column.length !== expected.length)
        );
      }) ||
      !actual.indices.some(
        (index) =>
          index.name === 'idx_application_image_cleanup_pending' &&
          !index.isUnique &&
          JSON.stringify(index.columnNames) ===
            JSON.stringify(['completedAt', 'failedAt', 'availableAt'])
      )
    )
      throw new Error('Incompatible application image cleanup schema');
    let cursor = '';
    for (;;) {
      const rows: ApplicationImageCleanupRow[] = await runner.query(
        'SELECT * FROM application_image_cleanup WHERE imageId > ? ORDER BY imageId LIMIT 200',
        [cursor]
      );
      for (const row of rows) validateApplicationImageCleanup(row);
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].imageId;
    }
    const registry = await editorialMediaAssetsApplied(runner);
    const invalid = [
      registry
        ? "SELECT c.imageId FROM application_image_cleanup c LEFT JOIN editorial_media_assets a ON a.kind='application' AND a.imageId=c.imageId LEFT JOIN application_image_uploads i ON i.id=c.imageId WHERE a.imageId IS NULL OR a.asset IS NOT NULL OR a.retiredAt IS NULL OR a.retiredAt<>c.createdAt OR (i.id IS NOT NULL AND (i.status<>'cancelled' OR i.revision NOT IN (2,3) OR i.tenantId<>a.tenantId OR i.createdAt<>a.createdAt OR i.asset IS NOT NULL OR i.leaseToken IS NOT NULL OR i.leaseUntil IS NOT NULL OR i.commandKey IS NOT NULL)) LIMIT 1"
        : "SELECT c.imageId FROM application_image_cleanup c LEFT JOIN application_image_uploads i ON i.id = c.imageId WHERE i.id IS NULL OR i.status <> 'cancelled' OR i.revision NOT IN (2, 3) OR c.createdAt < i.createdAt OR i.asset IS NOT NULL OR i.leaseToken IS NOT NULL OR i.leaseUntil IS NOT NULL OR i.commandKey IS NOT NULL LIMIT 1",
      "SELECT i.id FROM application_image_uploads i LEFT JOIN application_image_cleanup c ON c.imageId = i.id WHERE i.status = 'cancelled' AND c.imageId IS NULL LIMIT 1",
      `SELECT c.imageId FROM application_image_cleanup c JOIN application_image_uploads i ON i.id = c.imageId JOIN application_drafts d ON d.id = i.draftId WHERE (c.reason = 'expired' AND (i.revision <> 2 OR c.createdAt < i.expiresAt)) OR (c.reason = 'unreferenced' AND (i.revision <> 3 OR c.createdAt < i.createdAt + ${APPLICATION_IMAGE_UNUSED_LIFETIME})) OR (c.reason = 'draft-deleted' AND (d.deletedAt IS NULL OR c.createdAt < d.deletedAt)) LIMIT 1`,
      ...APPLICATION_IMAGE_REFERENCE_TABLES.map(
        (table) =>
          `SELECT c.imageId FROM application_image_cleanup c JOIN ${table} r ON r.imageId = c.imageId LIMIT 1`
      ),
      "SELECT i.id FROM application_image_uploads i JOIN application_image_commands c ON c.imageId = i.id WHERE i.status = 'cancelled' AND i.revision = 2 AND JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.status')) = 'ready' LIMIT 1",
      "SELECT i.id FROM application_image_uploads i WHERE i.status = 'cancelled' AND i.revision = 3 AND NOT EXISTS (SELECT 1 FROM application_image_commands c WHERE c.imageId = i.id AND c.tenantId = i.tenantId AND c.ownerIdentityId = i.ownerIdentityId AND JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.status')) = 'ready' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.revision')) AS UNSIGNED) = 2) LIMIT 1",
      "SELECT c.imageId FROM application_image_cleanup c JOIN application_image_uploads u ON u.id=c.imageId WHERE c.reason = 'cancelled' AND NOT EXISTS (SELECT 1 FROM application_image_commands r JOIN application_image_uploads i ON i.id = r.imageId AND i.tenantId = r.tenantId AND i.ownerIdentityId = r.ownerIdentityId WHERE r.imageId = c.imageId AND JSON_UNQUOTE(JSON_EXTRACT(r.receipt, '$.status')) = 'cancelled' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(r.receipt, '$.revision')) AS UNSIGNED) = i.revision AND r.completedAt = c.createdAt) LIMIT 1",
    ];
    if (registry) {
      invalid.push(
        "SELECT a.imageId FROM editorial_media_assets a LEFT JOIN application_image_cleanup c ON c.imageId=a.imageId WHERE a.kind='application' AND a.retiredAt IS NOT NULL AND c.imageId IS NULL LIMIT 1",
        `SELECT c.imageId FROM application_image_cleanup c JOIN editorial_media_assets a ON a.kind='application' AND a.imageId=c.imageId WHERE c.createdAt<a.createdAt OR (c.reason='unreferenced' AND c.createdAt<a.createdAt+${APPLICATION_IMAGE_UNUSED_LIFETIME}) LIMIT 1`
      );
    }
    for (const query of invalid)
      if ((await runner.query(query)).length)
        throw new Error('Invalid image retirement or cleanup relationships');
  }
  async down(): Promise<void> {
    throw new Error(
      'Image cleanup intents and tombstones are authoritative; use a reviewed data-preserving migration'
    );
  }
}
