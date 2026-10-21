import type { MigrationInterface, QueryRunner } from 'typeorm';
import { parseAccountPreferences } from '@domains/customer/preferences';

export class AccountPreferences1791676806000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('identities')))
      throw new Error('Preferences migration requires canonical identities');
    if (!(await runner.hasTable('identity_preferences'))) {
      await runner.query(`CREATE TABLE identity_preferences (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        preferences JSON NOT NULL,
        updatedAt bigint UNSIGNED NOT NULL,
        PRIMARY KEY (identityId)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable('identity_preferences');
    const [metadata]: { engine: string; collation: string }[] =
      await runner.query(
        "SELECT t.ENGINE AS engine, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = 'identity_preferences' AND c.COLUMN_NAME = 'identityId'"
      );
    if (
      !table ||
      metadata?.engine.toLowerCase() !== 'innodb' ||
      metadata.collation !== 'utf8mb4_bin' ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId'
    ) {
      throw new Error(
        'Incompatible canonical preferences keys or storage engine'
      );
    }
    for (const [name, type, length] of [
      ['identityId', 'varchar', '128'],
      ['preferences', 'json', ''],
      ['updatedAt', 'bigint', ''],
    ]) {
      const column = table.columns.find((item) => item.name === name);
      if (
        !column ||
        column.type !== type ||
        column.isNullable ||
        (length && column.length !== length) ||
        (name === 'updatedAt' && !column.unsigned)
      ) {
        throw new Error(`Incompatible identity_preferences.${name}`);
      }
    }
    if (
      table.columns.some(
        (column) =>
          !['identityId', 'preferences', 'updatedAt'].includes(column.name) &&
          !column.isNullable &&
          column.default == null &&
          !column.isGenerated
      )
    ) {
      throw new Error('Unsupported required preferences column');
    }
    let after: string | null = null;
    for (;;) {
      const rows: {
        identityId: string;
        preferences: unknown;
        updatedAt: unknown;
        revision: unknown;
        identityUpdatedAt: unknown;
        isDeleted: unknown;
      }[] = await runner.query(
        'SELECT p.*, i.revision, i.updated_at AS identityUpdatedAt, i.is_deleted AS isDeleted FROM identity_preferences p LEFT JOIN identities i ON BINARY i.claim = BINARY p.identityId WHERE (? IS NULL OR BINARY p.identityId > BINARY ?) ORDER BY BINARY p.identityId LIMIT 256',
        [after, after]
      );
      for (const row of rows) {
        const updatedAt = Number(row.updatedAt);
        if (
          row.isDeleted !== 0 ||
          !Number.isSafeInteger(updatedAt) ||
          updatedAt < 1 ||
          updatedAt > Number(row.identityUpdatedAt)
        ) {
          throw new Error(
            'Preferences have missing/deleted identity or invalid timestamp'
          );
        }
        parseAccountPreferences({
          identityId: row.identityId,
          revision: Number(row.revision),
          updatedAt,
          preferences:
            typeof row.preferences === 'string'
              ? JSON.parse(row.preferences)
              : row.preferences,
        });
      }
      if (rows.length < 256) break;
      after = rows[rows.length - 1].identityId;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Preferences rollback requires a reviewed data-preserving migration'
    );
  }
}
