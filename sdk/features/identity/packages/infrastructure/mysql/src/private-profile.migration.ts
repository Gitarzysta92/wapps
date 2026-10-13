import type { MigrationInterface, QueryRunner } from 'typeorm';
import { parseProfileSocialLinks } from '@domains/customer/profiles';

export class PrivateProfile1791676805000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('identity_accounts');
    if (
      !table ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId'
    ) {
      throw new Error(
        'Private profile migration requires the canonical account schema'
      );
    }
    const column = table.columns.find((item) => item.name === 'socialLinks');
    if (column) {
      if (column.type !== 'json' || !column.isNullable)
        throw new Error('Incompatible identity_accounts.socialLinks column');
    } else {
      // Nullable is deliberate: existing accounts have no social links. DDL can be retried after interruption.
      await runner.query(
        'ALTER TABLE identity_accounts ADD COLUMN socialLinks JSON NULL'
      );
    }
    let after: string | null = null;
    for (;;) {
      const rows: { identityId: string; socialLinks: unknown }[] =
        await runner.query(
          'SELECT identityId, socialLinks FROM identity_accounts WHERE (? IS NULL OR BINARY identityId > BINARY ?) ORDER BY BINARY identityId LIMIT 256',
          [after, after]
        );
      for (const row of rows) {
        if (row.socialLinks !== null)
          parseProfileSocialLinks(
            typeof row.socialLinks === 'string'
              ? JSON.parse(row.socialLinks)
              : row.socialLinks
          );
      }
      if (rows.length < 256) break;
      after = rows[rows.length - 1].identityId;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Private profile rollback requires a reviewed data-preserving migration'
    );
  }
}
