import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  changeProfileBadge,
  isPublicProfileId,
  parseProfileBadgeSnapshot,
} from '@domains/customer/profiles';
import { canonicalSqlInteger } from './canonical-account-sql';
import {
  badgeEventFromSql,
  badgeFingerprint,
  readBadgeSnapshot,
} from './mysql-profile-badges';

const schemas = [
  {
    name: 'identity_profile_badges',
    columns: [
      ['ownerId', 'char', '36'],
      ['kind', 'varchar', '16'],
      ['revision', 'bigint', ''],
      ['active', 'tinyint', ''],
      ['awardedAt', 'bigint', ''],
      ['updatedAt', 'bigint', ''],
    ],
    indexes: { PRIMARY: ['ownerId,kind', 0] },
    sql: `CREATE TABLE identity_profile_badges (
      ownerId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      kind varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      revision bigint UNSIGNED NOT NULL, active tinyint UNSIGNED NOT NULL,
      awardedAt bigint UNSIGNED NOT NULL, updatedAt bigint UNSIGNED NOT NULL,
      PRIMARY KEY (ownerId, kind)
    ) ENGINE=InnoDB`,
  },
  {
    name: 'identity_profile_badge_events',
    columns: [
      ['ownerId', 'char', '36'],
      ['revision', 'bigint', ''],
      ['kind', 'varchar', '16'],
      ['action', 'varchar', '6'],
      ['reason', 'varchar', '1000'],
      ['actorId', 'char', '36'],
      ['commandKey', 'varchar', '128'],
      ['fingerprint', 'char', '64'],
      ['createdAt', 'bigint', ''],
    ],
    indexes: {
      PRIMARY: ['ownerId,revision', 0],
      badge_command: ['actorId,commandKey', 0],
    },
    sql: `CREATE TABLE identity_profile_badge_events (
      ownerId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      revision bigint UNSIGNED NOT NULL,
      kind varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      action varchar(6) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      reason varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      actorId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      commandKey varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      fingerprint char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      createdAt bigint UNSIGNED NOT NULL,
      PRIMARY KEY (ownerId, revision), UNIQUE KEY badge_command (actorId, commandKey)
    ) ENGINE=InnoDB`,
  },
] as const;

export class ProfileBadges1791676831000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner, erasedActors?: boolean): Promise<void> {
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const successor: unknown[] =
      erasedActors === undefined && (await runner.hasTable(history))
        ? await runner.query(
            `SELECT name FROM ${runner.connection.driver.escape(
              history
            )} WHERE name = ?`,
            ['ProfileBadgeErasure1791840003000']
          )
        : [];
    const allowErased = erasedActors ?? successor.length > 0;
    if (!(await runner.hasTable('identity_accounts')))
      throw new Error('Badges require canonical accounts');
    for (const schema of schemas) {
      if (!(await runner.hasTable(schema.name))) {
        const applied: unknown[] = (await runner.hasTable('migrations'))
          ? await runner.query('SELECT id FROM migrations WHERE name = ?', [
              'ProfileBadges1791676831000',
            ])
          : [];
        if (applied.length)
          throw new Error(`Applied badge table is missing: ${schema.name}`);
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
        const column = table.columns.find((column) => column.name === name),
          meta = metadata.find((column) => column.name === name);
        if (
          !column ||
          column.type !== type ||
          column.isNullable !==
            (allowErased &&
              schema.name === 'identity_profile_badge_events' &&
              ['reason', 'actorId', 'commandKey', 'fingerprint'].includes(
                name
              )) ||
          meta?.engine.toLowerCase() !== 'innodb' ||
          (length
            ? column.length !== length ||
              meta.collation !==
                (name === 'reason' ? 'utf8mb4_bin' : 'ascii_bin')
            : !column.unsigned || meta.collation !== null)
        )
          throw new Error(`Incompatible ${schema.name}.${name}`);
      }
      const indexes: {
        name: string;
        columns: string;
        prefix: unknown;
        nonUnique: unknown;
      }[] = await runner.query(
        'SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? GROUP BY INDEX_NAME',
        [schema.name]
      );
      for (const [name, [columns, nonUnique]] of Object.entries(
        schema.indexes
      )) {
        if (
          !indexes.some(
            (index) =>
              index.name === name &&
              index.columns === columns &&
              index.prefix === null &&
              canonicalSqlInteger(index.nonUnique) === nonUnique
          )
        )
          throw new Error(`Incompatible ${schema.name} index ${name}`);
      }
    }
    let after: string | null = null;
    for (;;) {
      const owners: { ownerId: string }[] = await runner.query(
        'SELECT ownerId FROM (SELECT ownerId FROM identity_profile_badges UNION SELECT ownerId FROM identity_profile_badge_events) owners WHERE (? IS NULL OR ownerId > ?) ORDER BY ownerId LIMIT 256',
        [after, after]
      );
      for (const { ownerId } of owners)
        await this.validateHistory(runner, ownerId, allowErased);
      if (owners.length < 256) break;
      after = owners[owners.length - 1].ownerId;
    }
  }
  private async validateHistory(
    runner: QueryRunner,
    ownerId: string,
    allowErased: boolean
  ) {
    if (!isPublicProfileId(ownerId)) throw new Error('Invalid badge owner');
    const [owner]: {
      updatedAt: unknown;
      revision: unknown;
      identity_id: string;
      is_deleted: number;
      is_active: number;
    }[] = await runner.query(
      'SELECT updated_at AS updatedAt, revision, identity_id, is_deleted, is_active FROM identities WHERE id = ?',
      [ownerId]
    );
    if (!owner) throw new Error('Missing badge identity');
    if (allowErased && owner.is_deleted === 1 && owner.is_active === 0) {
      const [cleanup]: {
        revision: unknown;
        erasureRevision: unknown;
        completedAt: unknown;
      }[] = await runner.query(
        'SELECT r.revision, b.erasureRevision, r.completedAt FROM identity_erasure_requests r INNER JOIN identity_erasure_barriers b ON b.identityId = r.identityId WHERE r.identityId = ?',
        [owner.identity_id]
      );
      if (
        cleanup &&
        canonicalSqlInteger(cleanup.revision, 1) ===
          canonicalSqlInteger(owner.revision, 1) &&
        canonicalSqlInteger(cleanup.erasureRevision, 1) ===
          canonicalSqlInteger(owner.revision, 1)
      ) {
        if (cleanup.completedAt !== null)
          throw new Error(
            'Completed Account erasure retains private badge history'
          );
        // An inaccessible erased recipient's history is removed in bounded batches.
        return;
      }
    }
    let replay = parseProfileBadgeSnapshot({
      profileId: ownerId,
      revision: 0,
      badges: [],
    });
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT e.*, i.id AS existingActor FROM identity_profile_badge_events e LEFT JOIN identities i ON i.id=e.actorId WHERE e.ownerId = ? AND e.revision > ? ORDER BY e.revision LIMIT 256',
        [ownerId, replay.revision]
      );
      for (const row of rows) {
        const event = badgeEventFromSql(row);
        const command = {
          expectedRevision: event.revision - 1,
          kind: event.kind,
          action: event.action,
          reason: event.reason ?? 'Erased staff decision',
        };
        if (
          event.revision !== replay.revision + 1 ||
          (event.actorId === null
            ? !allowErased ||
              row.commandKey !== null ||
              row.fingerprint !== null
            : row.existingActor !== event.actorId ||
              typeof row.commandKey !== 'string' ||
              !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey) ||
              badgeFingerprint(ownerId, command) !== row.fingerprint) ||
          event.at > canonicalSqlInteger(owner.updatedAt, 1) ||
          event.revision > canonicalSqlInteger(owner.revision, 1)
        )
          throw new Error('Invalid badge audit history');
        replay = changeProfileBadge(replay, command, event.at);
      }
      if (rows.length < 256) break;
    }
    if (
      JSON.stringify(replay) !==
      JSON.stringify(await readBadgeSnapshot(runner.manager, ownerId))
    )
      throw new Error('Badge state disagrees with audit history');
  }
  async down(): Promise<void> {
    throw new Error(
      'Badge rollback requires a reviewed data-preserving migration'
    );
  }
}
