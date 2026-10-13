import { MysqlFavoriteUpdates } from './mysql-favorite-updates';
import {
  favoriteUpdateId,
  favoriteUpdateTime,
} from '@domains/customer/favorites';
import { AccountFavoriteUpdates1791840019000 } from './account-favorite-updates.migration';
import { AccountNotifications1791840016000 } from './account-notifications.migration';
import { AccountMentions1791864017000 } from './account-mentions.migration';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { IdentityEntity } from './identity.entity';
import { CreateIdentities1788566400000 } from './create-identities.migration';
import { CanonicalIdentity1791676804000 } from './canonical-identity.migration';
import { PrivateProfile1791676805000 } from './private-profile.migration';
import { AccountPreferences1791676806000 } from './account-preferences.migration';
import { AccountFavorites1791676807000 } from './account-favorites.migration';
import { ProfileAvatars1791676828000 } from './profile-avatars.migration';
import { ProfileFollows1791676829000 } from './profile-follows.migration';
import { ProfileContactEmail1791676830000 } from './profile-contact-email.migration';
import { ProfileBadges1791676831000 } from './profile-badges.migration';
import { AccountExports1791676832000 } from './account-exports.migration';
import { IdentityWriteBarrier1791840000000 } from './identity-write-barrier.migration';
import { AccountErasureRequests1791840001000 } from './account-erasure-requests.migration';
import { AccountErasureCoordination1791840002000 } from './account-erasure-coordination.migration';
import { ProfileBadgeErasure1791840003000 } from './profile-badge-erasure.migration';

type Command =
  | { mode: 'migrate' }
  | { mode: 'favorite-update-status' }
  | { mode: 'favorite-update-requeue'; generation: string; failedAt: number }
  | { mode: 'outbox-status' }
  | { mode: 'cleanup-status' }
  | { mode: 'erasure-status' }
  | {
      mode: 'outbox-requeue' | 'cleanup-requeue' | 'erasure-requeue';
      id: string;
    };

export function parseIdentityMaintenance(args: string[]): Command | null {
  if (!args.length) return null;
  if (args.length === 1 && args[0] === '--favorite-update-status')
    return { mode: 'favorite-update-status' };
  if (
    args.length === 4 &&
    args[0] === '--favorite-update-requeue' &&
    args[2] === '--failed-at' &&
    /^[1-9][0-9]{0,15}$/.test(args[3])
  )
    return {
      mode: 'favorite-update-requeue',
      generation: favoriteUpdateId(args[1]),
      failedAt: favoriteUpdateTime(Number(args[3])),
    };
  if (
    args.length === 1 &&
    [
      '--migrate',
      '--outbox-status',
      '--cleanup-status',
      '--erasure-status',
    ].includes(args[0])
  )
    return {
      mode: args[0].slice(2) as
        | 'migrate'
        | 'outbox-status'
        | 'cleanup-status'
        | 'erasure-status',
    };
  if (
    args.length === 2 &&
    args[0] === '--outbox-requeue' &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(args[1])
  )
    return { mode: 'outbox-requeue', id: args[1] };
  if (
    args.length === 2 &&
    ['--cleanup-requeue', '--erasure-requeue'].includes(args[0]) &&
    isCanonicalIdentityId(args[1])
  )
    return {
      mode:
        args[0] === '--cleanup-requeue' ? 'cleanup-requeue' : 'erasure-requeue',
      id: args[1],
    };
  throw new Error(
    'Expected --migrate, --outbox-status, --cleanup-status, --erasure-status, --outbox-requeue <event-uuid>, --cleanup-requeue <uid>, or --erasure-requeue <uid>'
  );
}

export function identityDataSource(
  env: Record<string, string | undefined>
): DataSource {
  const required = (name: string): string => {
    const value = env[name];
    if (!value?.trim()) throw new Error(`${name} is required`);
    return value;
  };
  const rawPort = required('MYSQL_PORT');
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535)
    throw new Error('MYSQL_PORT must be a TCP port');
  return new DataSource({
    type: 'mysql',
    host: required('MYSQL_HOST'),
    port: Number(rawPort),
    username: required('MYSQL_USERNAME'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DATABASE'),
    entities: [IdentityEntity],
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: 'none',
    migrations: [
      CreateIdentities1788566400000,
      CanonicalIdentity1791676804000,
      PrivateProfile1791676805000,
      AccountPreferences1791676806000,
      AccountFavorites1791676807000,
      ProfileAvatars1791676828000,
      ProfileFollows1791676829000,
      ProfileContactEmail1791676830000,
      ProfileBadges1791676831000,
      AccountExports1791676832000,
      IdentityWriteBarrier1791840000000,
      AccountErasureRequests1791840001000,
      AccountErasureCoordination1791840002000,
      ProfileBadgeErasure1791840003000,
      AccountNotifications1791840016000,
      AccountMentions1791864017000,
      AccountFavoriteUpdates1791840019000,
    ],
    connectTimeout: 10_000,
    logging: false,
  });
}

/** This entrypoint starts no API, Firebase client, broker, or background worker. */
export async function runIdentityMaintenance(
  args: string[],
  env: Record<string, string | undefined>,
  report: (value: unknown) => void
): Promise<number | null> {
  const command = parseIdentityMaintenance(args);
  if (!command) return null;
  const source = identityDataSource(env);
  await source.initialize();
  try {
    if (command.mode === 'favorite-update-status') {
      report(await new MysqlFavoriteUpdates(source).status());
      return 0;
    }
    if (command.mode === 'favorite-update-requeue') {
      const requeued = await new MysqlFavoriteUpdates(source).requeue(
        command.generation,
        command.failedAt
      );
      report({ requeued });
      return requeued ? 0 : 2;
    }
    if (command.mode === 'migrate') {
      const runner = source.createQueryRunner();
      await runner.connect();
      const lock = `wapps-identity:${createHash('sha256')
        .update(env['MYSQL_DATABASE'] ?? '')
        .digest('hex')
        .slice(0, 40)}`;
      let acquired = false;
      try {
        const [result]: { acquired: unknown }[] = await runner.query(
          'SELECT GET_LOCK(?, 10) AS acquired',
          [lock]
        );
        if (result?.acquired !== 1 && result?.acquired !== '1')
          throw new Error('Identity migration is already running');
        acquired = true;
        if (await runner.hasTable('identity_subjects')) {
          const legacy: unknown[] = await runner.query(
            'SELECT 1 FROM identity_subjects LIMIT 1'
          );
          if (legacy.length)
            throw new Error(
              'Legacy subject mappings require verified migration before canonical cutover'
            );
        }
        const migrations = await source.runMigrations({ transaction: 'none' });
        report({ migrated: migrations.map((migration) => migration.name) });
        return 0;
      } finally {
        if (acquired) await runner.query('SELECT RELEASE_LOCK(?)', [lock]);
        await runner.release();
      }
    }
    if (await source.showMigrations())
      throw new Error('Run --migrate before identity maintenance');
    if (
      command.mode === 'outbox-status' ||
      command.mode === 'cleanup-status' ||
      command.mode === 'erasure-status'
    ) {
      const cleanup = command.mode !== 'outbox-status';
      const table =
        command.mode === 'erasure-status'
          ? 'identity_erasure_jobs'
          : cleanup
          ? 'identity_deletion_jobs'
          : 'identity_events_outbox';
      const completed = cleanup ? 'completedAt' : 'deliveredAt';
      const [counts] = await source.query(
        `SELECT COUNT(*) AS total, COALESCE(SUM(${completed} IS NOT NULL), 0) AS completed, COALESCE(SUM(failedAt IS NOT NULL), 0) AS failed, COALESCE(SUM(${completed} IS NULL AND failedAt IS NULL), 0) AS pending, MIN(CASE WHEN ${completed} IS NULL AND failedAt IS NULL THEN createdAt END) AS oldestPendingAt FROM ${table}`
      );
      const failures = await source.query(
        `SELECT ${
          cleanup ? 'identityId' : 'id'
        } AS id, attempts, failedAt FROM ${table} WHERE failedAt IS NOT NULL ORDER BY failedAt LIMIT 100`
      );
      report({
        kind:
          command.mode === 'erasure-status'
            ? 'erasure'
            : cleanup
            ? 'cleanup'
            : 'outbox',
        counts,
        failures,
      });
      return 0;
    }
    const cleanup = command.mode !== 'outbox-requeue';
    const table =
      command.mode === 'erasure-requeue'
        ? 'identity_erasure_jobs'
        : 'identity_deletion_jobs';
    const at = Date.now();
    const changed: { affectedRows: number } = cleanup
      ? await source.query(
          `UPDATE ${table} j INNER JOIN identities i ON BINARY i.identity_id = BINARY j.identityId SET j.failedAt = NULL, j.attempts = 0, j.availableAt = ?, j.leaseToken = NULL, j.leasedUntil = NULL WHERE j.identityId = ? AND j.failedAt IS NOT NULL AND j.completedAt IS NULL AND (j.leasedUntil IS NULL OR j.leasedUntil < ?) AND i.is_active = 0 AND i.is_deleted = 1 AND i.revision ${
            command.mode === 'erasure-requeue' ? '=' : '>='
          } j.revision`,
          [at, command.id, at]
        )
      : await source.query(
          'UPDATE identity_events_outbox SET failedAt = NULL, attempts = 0, availableAt = ?, leaseToken = NULL, leasedUntil = NULL WHERE id = ? AND failedAt IS NOT NULL AND deliveredAt IS NULL AND (leasedUntil IS NULL OR leasedUntil < ?)',
          [at, command.id, at]
        );
    report({
      requeued: changed.affectedRows === 1,
      kind:
        command.mode === 'erasure-requeue'
          ? 'erasure'
          : cleanup
          ? 'cleanup'
          : 'outbox',
    });
    return changed.affectedRows === 1 ? 0 : 2;
  } finally {
    await source.destroy();
  }
}
