import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LegacyIdentityImport1792281603000 implements MigrationInterface {
  name = 'LegacyIdentityImport1792281603000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS identity_legacy_imports (
      identityId varchar(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
      planHash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      sourceHash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      importedAt bigint unsigned NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    const table = await runner.getTable('identity_legacy_imports');
    const [storage]: { engine: string }[] = await runner.query(
      "SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'identity_legacy_imports'"
    );
    if (
      !table ||
      storage?.engine.toLowerCase() !== 'innodb' ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId'
    )
      throw new Error('Incompatible legacy import receipt storage');
    for (const [name, type, length] of [
      ['identityId', 'varchar', '128'],
      ['planHash', 'char', '64'],
      ['sourceHash', 'char', '64'],
      ['importedAt', 'bigint', ''],
    ]) {
      const column = table.columns.find((item) => item.name === name);
      if (
        !column ||
        column.type !== type ||
        column.isNullable ||
        (length && column.length !== length) ||
        (name === 'importedAt' && !column.unsigned)
      )
        throw new Error('Incompatible legacy import receipt columns');
    }
  }

  async down(): Promise<void> {
    throw new Error('Legacy import receipts require a reviewed backup restore');
  }
}
