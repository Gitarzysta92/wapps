import type { MigrationInterface, QueryRunner } from 'typeorm';
import { parseProfileContactEmail } from '@domains/customer/profiles';

export class ProfileContactEmail1791676830000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('identity_accounts');
    if (
      !table ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId'
    )
      throw new Error('Contact email requires canonical accounts');
    if (!table.columns.some((column) => column.name === 'contactEmail')) {
      if (await runner.hasTable('migrations')) {
        const recorded: unknown[] = await runner.query(
          'SELECT id FROM migrations WHERE name = ?',
          ['ProfileContactEmail1791676830000']
        );
        if (recorded.length)
          throw new Error('Applied contact email column is missing');
      }
      await runner.query(
        'ALTER TABLE identity_accounts ADD COLUMN contactEmail varchar(254) CHARACTER SET ascii COLLATE ascii_bin NULL'
      );
    }
    const columns: {
      engine: string;
      type: string;
      length: unknown;
      nullable: string;
      collation: string;
      defaultValue: unknown;
      extra: string;
    }[] = await runner.query(
      'SELECT t.ENGINE AS engine, c.DATA_TYPE AS type, c.CHARACTER_MAXIMUM_LENGTH AS length, c.IS_NULLABLE AS nullable, c.COLLATION_NAME AS collation, c.COLUMN_DEFAULT AS defaultValue, c.EXTRA AS extra FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ? AND c.COLUMN_NAME = ?',
      ['identity_accounts', 'contactEmail']
    );
    const column = columns[0];
    if (
      columns.length !== 1 ||
      column.engine.toLowerCase() !== 'innodb' ||
      column.type !== 'varchar' ||
      Number(column.length) !== 254 ||
      column.nullable !== 'YES' ||
      column.collation !== 'ascii_bin' ||
      column.defaultValue !== null ||
      column.extra !== ''
    )
      throw new Error('Incompatible identity_accounts.contactEmail column');
    let after: string | null = null;
    for (;;) {
      const rows: { identityId: string; contactEmail: unknown }[] =
        await runner.query(
          'SELECT identityId, contactEmail FROM identity_accounts WHERE (? IS NULL OR BINARY identityId > BINARY ?) ORDER BY BINARY identityId LIMIT 256',
          [after, after]
        );
      for (const row of rows) {
        if (parseProfileContactEmail(row.contactEmail) !== row.contactEmail)
          throw new Error('Non-canonical stored contact email');
      }
      if (rows.length < 256) break;
      after = rows[rows.length - 1].identityId;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Contact email rollback requires a reviewed data-preserving migration'
    );
  }
}
