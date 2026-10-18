import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseAccountFavorites,
} from '@domains/customer/favorites';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';

export class AccountFavorites1791676807000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('identities')))
      throw new Error('Favorites migration requires canonical identities');
    if (!(await runner.hasTable('identity_favorites'))) {
      await runner.query(`CREATE TABLE identity_favorites (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        targetKind varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        targetId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        addedAt bigint UNSIGNED NOT NULL,
        PRIMARY KEY (identityId, targetKind, targetId)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable('identity_favorites');
    const metadata: { engine: string; name: string; collation: string }[] =
      await runner.query(
        "SELECT t.ENGINE AS engine, c.COLUMN_NAME AS name, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = 'identity_favorites'"
      );
    const columns = [
      ['identityId', 'varchar', '128'],
      ['targetKind', 'varchar', '16'],
      ['targetId', 'varchar', '36'],
      ['addedAt', 'bigint', ''],
    ];
    const [primary]: { keyColumns: string }[] = await runner.query(
      "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS keyColumns FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'identity_favorites' AND INDEX_NAME = 'PRIMARY'"
    );
    if (
      !table ||
      table.primaryColumns.length !== 3 ||
      primary?.keyColumns !== 'identityId,targetKind,targetId'
    )
      throw new Error('Incompatible canonical favorites primary key');
    const uniqueKeys = [
      ...table.uniques,
      ...table.indices.filter((index) => index.isUnique),
    ];
    if (
      uniqueKeys.some(
        (index) =>
          !['identityId', 'targetKind', 'targetId'].every((name) =>
            index.columnNames.includes(name)
          )
      )
    )
      throw new Error('Incompatible canonical favorites unique key');
    for (const [name, type, length] of columns) {
      const column = table.columns.find((column) => column.name === name);
      const info = metadata.find((column) => column.name === name);
      if (
        !column ||
        column.type !== type ||
        column.isNullable ||
        info?.engine.toLowerCase() !== 'innodb' ||
        (length &&
          (column.length !== length || info.collation !== 'utf8mb4_bin')) ||
        (name === 'addedAt' && !column.unsigned)
      )
        throw new Error(`Incompatible identity_favorites.${name}`);
    }
    if (
      table.columns.some(
        (column) =>
          !columns.some(([name]) => name === column.name) &&
          !column.isNullable &&
          column.default == null &&
          !column.isGenerated
      )
    )
      throw new Error('Unsupported required favorites column');
    let after: [string, string, string] | null = null;
    let lastIdentity: string | null = null;
    let accountCount = 0;
    for (;;) {
      const rows: {
        identityId: string;
        targetKind: string;
        targetId: string;
        addedAt: unknown;
        revision: unknown;
        isDeleted: unknown;
        identityUpdatedAt: unknown;
      }[] = await runner.query(
        'SELECT f.*, i.revision, i.is_deleted AS isDeleted, i.updated_at AS identityUpdatedAt FROM identity_favorites f LEFT JOIN identities i ON BINARY i.claim = BINARY f.identityId WHERE (? IS NULL OR (f.identityId, f.targetKind, f.targetId) > (?, ?, ?)) ORDER BY f.identityId, f.targetKind, f.targetId LIMIT 256',
        [after?.[0] ?? null, ...(after ?? [null, null, null])]
      );
      for (const row of rows) {
        accountCount = row.identityId === lastIdentity ? accountCount + 1 : 1;
        lastIdentity = row.identityId;
        if (
          !isCanonicalIdentityId(row.identityId) ||
          row.isDeleted !== 0 ||
          !Number.isSafeInteger(Number(row.identityUpdatedAt)) ||
          Number(row.identityUpdatedAt) < 1 ||
          Number(row.addedAt) > Number(row.identityUpdatedAt) ||
          accountCount > ACCOUNT_FAVORITES_LIMIT
        )
          throw new Error(
            'Favorites have missing/deleted identity, invalid timestamp or exceeded limit'
          );
        parseAccountFavorites({
          identityId: row.identityId,
          revision: Number(row.revision),
          favorites: [
            {
              kind: row.targetKind,
              id: row.targetId,
              addedAt: Number(row.addedAt),
            },
          ],
        });
      }
      if (rows.length < 256) break;
      const last = rows[rows.length - 1];
      after = [last.identityId, last.targetKind, last.targetId];
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Favorites rollback requires a reviewed data-preserving migration'
    );
  }
}
