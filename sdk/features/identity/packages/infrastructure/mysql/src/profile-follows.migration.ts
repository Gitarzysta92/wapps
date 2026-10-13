import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  isPublicProfileId,
  parseProfileFollow,
} from '@domains/customer/profiles';
import { canonicalSqlInteger } from './canonical-account-sql';

const schemas = [
  {
    name: 'identity_profile_follows',
    columns: [
      ['ownerId', 'char', '36'],
      ['requesterId', 'char', '36'],
      ['revision', 'bigint', ''],
      ['status', 'varchar', '8'],
      ['updatedAt', 'bigint', ''],
    ],
    indexes: {
      PRIMARY: 'ownerId,requesterId',
      follows_requester: 'requesterId,status,ownerId',
      follows_owner: 'ownerId,status,requesterId',
    },
    sql: `CREATE TABLE identity_profile_follows (
      ownerId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      requesterId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      revision bigint UNSIGNED NOT NULL,
      status varchar(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      updatedAt bigint UNSIGNED NOT NULL,
      PRIMARY KEY (ownerId, requesterId),
      KEY follows_requester (requesterId, status, ownerId),
      KEY follows_owner (ownerId, status, requesterId)
    ) ENGINE=InnoDB`,
  },
  {
    name: 'identity_profile_follow_commands',
    columns: [
      ['actorId', 'char', '36'],
      ['commandKey', 'varchar', '128'],
      ['ownerId', 'char', '36'],
      ['requesterId', 'char', '36'],
      ['fingerprint', 'char', '64'],
      ['revision', 'bigint', ''],
      ['status', 'varchar', '8'],
      ['createdAt', 'bigint', ''],
    ],
    indexes: {
      PRIMARY: 'actorId,commandKey',
      follow_commands_owner: 'ownerId',
      follow_commands_requester: 'requesterId',
      follow_commands_rate: 'actorId,status,createdAt',
    },
    sql: `CREATE TABLE identity_profile_follow_commands (
      actorId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      commandKey varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      ownerId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      requesterId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      fingerprint char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      revision bigint UNSIGNED NOT NULL,
      status varchar(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      createdAt bigint UNSIGNED NOT NULL,
      PRIMARY KEY (actorId, commandKey),
      KEY follow_commands_owner (ownerId), KEY follow_commands_requester (requesterId),
      KEY follow_commands_rate (actorId, status, createdAt)
    ) ENGINE=InnoDB`,
  },
] as const;

export class ProfileFollows1791676829000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    if (
      !(await runner.hasTable('identities')) ||
      !(await runner.hasTable('identity_accounts'))
    )
      throw new Error('Followers require canonical accounts');
    for (const schema of schemas) {
      if (!(await runner.hasTable(schema.name))) {
        if (await runner.hasTable('migrations')) {
          const recorded: unknown[] = await runner.query('SELECT id FROM migrations WHERE name = ?', ['ProfileFollows1791676829000']);
          if (recorded.length) throw new Error(`Applied follower table is missing: ${schema.name}`);
        }
        await runner.query(schema.sql);
      }
      const table = await runner.getTable(schema.name);
      const metadata: {
        name: string;
        engine: string;
        collation: string | null;
      }[] = await runner.query(
        'SELECT c.COLUMN_NAME AS name, t.ENGINE AS engine, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ?',
        [schema.name]
      );
      if (!table || table.columns.length !== schema.columns.length)
        throw new Error(`Incompatible ${schema.name} schema`);
      for (const [name, type, length] of schema.columns) {
        const column = table.columns.find((column) => column.name === name);
        const meta = metadata.find((column) => column.name === name);
        if (
          !column ||
          column.type !== type ||
          column.isNullable ||
          meta?.engine.toLowerCase() !== 'innodb' ||
          (length
            ? column.length !== length || meta.collation !== 'ascii_bin'
            : !column.unsigned || meta.collation !== null)
        )
          throw new Error(`Incompatible ${schema.name}.${name}`);
      }
      const indexes: {
        name: string;
        columns: string;
        prefix: unknown;
        nonUnique: number;
      }[] = await runner.query(
        'SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? GROUP BY INDEX_NAME',
        [schema.name]
      );
      for (const [name, columns] of Object.entries(schema.indexes)) {
        if (
          !indexes.some(
            (index) =>
              index.name === name &&
              index.columns === columns &&
              index.prefix === null &&
              canonicalSqlInteger(index.nonUnique) === (name === 'PRIMARY' ? 0 : 1)
          )
        )
          throw new Error(`Incompatible ${schema.name} index ${name}`);
      }
      if (
        indexes.some(
          (index) => index.name !== 'PRIMARY' && canonicalSqlInteger(index.nonUnique) === 0
        )
      )
        throw new Error('Unsupported follower unique constraint');
    }
    let after: [string, string] | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT f.*, o.is_deleted AS ownerDeleted, r.is_deleted AS requesterDeleted, o.updated_at AS ownerUpdatedAt, r.updated_at AS requesterUpdatedAt FROM identity_profile_follows f LEFT JOIN identities o ON o.id = f.ownerId LEFT JOIN identities r ON r.id = f.requesterId WHERE (? IS NULL OR (f.ownerId, f.requesterId) > (?, ?)) ORDER BY f.ownerId, f.requesterId LIMIT 256',
        [after?.[0] ?? null, ...(after ?? [null, null])]
      );
      for (const row of rows) {
        parseProfileFollow({
          ownerId: row.ownerId,
          requesterId: row.requesterId,
          revision: canonicalSqlInteger(row.revision, 1),
          status: row.status,
        });
        if (
          row.ownerDeleted !== 0 ||
          row.requesterDeleted !== 0 ||
          canonicalSqlInteger(row.updatedAt, 1) >
            Math.min(
              canonicalSqlInteger(row.ownerUpdatedAt, 1),
              canonicalSqlInteger(row.requesterUpdatedAt, 1)
            )
        )
          throw new Error('Invalid follower lifecycle');
      }
      if (rows.length < 256) break;
      const last = rows[rows.length - 1];
      after = [String(last.ownerId), String(last.requesterId)];
    }
    let commandAfter: [string, string] | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT c.*, f.revision AS currentRevision FROM identity_profile_follow_commands c LEFT JOIN identity_profile_follows f ON f.ownerId = c.ownerId AND f.requesterId = c.requesterId WHERE (? IS NULL OR (c.actorId, c.commandKey) > (?, ?)) ORDER BY c.actorId, c.commandKey LIMIT 256',
        [commandAfter?.[0] ?? null, ...(commandAfter ?? [null, null])]
      );
      for (const row of rows) {
        parseProfileFollow({
          ownerId: row.ownerId,
          requesterId: row.requesterId,
          revision: canonicalSqlInteger(row.revision, 1),
          status: row.status,
        });
        if (
          !isPublicProfileId(row.actorId) ||
          ![row.ownerId, row.requesterId].includes(row.actorId) ||
          typeof row.commandKey !== 'string' ||
          !/^[\x21-\x7e]{1,128}$/.test(row.commandKey) ||
          typeof row.fingerprint !== 'string' ||
          !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
          canonicalSqlInteger(row.currentRevision, 1) <
            canonicalSqlInteger(row.revision, 1)
        )
          throw new Error('Invalid follower receipt');
        canonicalSqlInteger(row.createdAt, 1);
      }
      if (rows.length < 256) break;
      const last = rows[rows.length - 1];
      commandAfter = [String(last.actorId), String(last.commandKey)];
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Followers rollback requires a reviewed data-preserving migration'
    );
  }
}
