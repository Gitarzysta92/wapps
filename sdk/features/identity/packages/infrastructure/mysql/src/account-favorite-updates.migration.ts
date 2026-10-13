import { randomUUID } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureJournalTable } from '@sdk/extras/mysql';
import {
  favoriteWatchRow,
  favoriteUpdateReceiptRow,
} from './mysql-favorite-updates';

export class AccountFavoriteUpdates1791840019000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (
      !(await runner.hasTable('identity_favorites')) ||
      !(await runner.hasTable('identity_erasure_requests'))
    )
      throw new Error(
        'Favorite updates require canonical favorites and erasure'
      );
    const uuid = { type: 'char(36)', collation: 'ascii_bin' },
      time = { type: 'bigint unsigned' };
    const common = {
      identityId: { type: 'varchar(128)', collation: 'utf8mb4_bin' },
      targetKind: { type: 'varchar(16)', collation: 'utf8mb4_bin' },
      targetId: { type: 'varchar(36)', collation: 'utf8mb4_bin' },
      generation: uuid,
    };
    await ensureJournalTable(runner, {
      name: 'identity_favorite_watches',
      migration: this.constructor.name,
      create: `CREATE TABLE identity_favorite_watches (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        targetKind varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        targetId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        generation char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        version bigint unsigned NULL, sourceAt bigint unsigned NULL,
        attempts tinyint unsigned NOT NULL DEFAULT 0, availableAt bigint unsigned NOT NULL,
        leaseToken char(36) CHARACTER SET ascii COLLATE ascii_bin NULL, leasedUntil bigint unsigned NULL, failedAt bigint unsigned NULL,
        PRIMARY KEY (identityId,targetKind,targetId), UNIQUE KEY idx_favorite_generation (generation),
        INDEX idx_favorite_due (failedAt,availableAt,generation), INDEX idx_favorite_watch_export (identityId,generation)
      ) ENGINE=InnoDB`,
      columns: {
        ...common,
        version: { ...time, nullable: true },
        sourceAt: { ...time, nullable: true },
        attempts: { type: 'tinyint unsigned', initial: '0' },
        availableAt: time,
        leaseToken: { ...uuid, nullable: true },
        leasedUntil: { ...time, nullable: true },
        failedAt: { ...time, nullable: true },
      },
      indexes: {
        PRIMARY: {
          columns: ['identityId', 'targetKind', 'targetId'],
          unique: true,
        },
        idx_favorite_generation: { columns: ['generation'], unique: true },
        idx_favorite_due: {
          columns: ['failedAt', 'availableAt', 'generation'],
          unique: false,
        },
        idx_favorite_watch_export: {
          columns: ['identityId', 'generation'],
          unique: false,
        },
      },
    });
    await ensureJournalTable(runner, {
      name: 'identity_favorite_notifications',
      migration: this.constructor.name,
      create: `CREATE TABLE identity_favorite_notifications (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        generation char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        targetKind varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        targetId varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        version bigint unsigned NOT NULL, sourceAt bigint unsigned NOT NULL, createdAt bigint unsigned NOT NULL,
        delivered tinyint unsigned NOT NULL, readAt bigint unsigned NULL,
        PRIMARY KEY (identityId,id), UNIQUE KEY idx_favorite_receipt (identityId,generation,version),
        INDEX idx_favorite_inbox (identityId,delivered,createdAt,id)
      ) ENGINE=InnoDB`,
      columns: {
        ...common,
        id: uuid,
        version: time,
        sourceAt: time,
        createdAt: time,
        delivered: { type: 'tinyint unsigned' },
        readAt: { ...time, nullable: true },
      },
      indexes: {
        PRIMARY: { columns: ['identityId', 'id'], unique: true },
        idx_favorite_receipt: {
          columns: ['identityId', 'generation', 'version'],
          unique: true,
        },
        idx_favorite_inbox: {
          columns: ['identityId', 'delivered', 'createdAt', 'id'],
          unique: false,
        },
      },
    });
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const applied: unknown[] = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT name FROM ${runner.connection.driver.escape(
            history
          )} WHERE name=?`,
          [this.constructor.name]
        )
      : [];
    // Existing favorites start at their first successful observation, never at historical version zero.
    for (;;) {
      const rows: Record<string, unknown>[] =
        await runner.query(`SELECT f.* FROM identity_favorites f
        JOIN identities i ON BINARY i.claim=BINARY f.identityId AND i.is_deleted=0
        LEFT JOIN identity_favorite_watches w ON w.identityId=f.identityId AND w.targetKind=f.targetKind AND w.targetId=f.targetId
        WHERE w.generation IS NULL ORDER BY f.identityId,f.targetKind,f.targetId LIMIT 128`);
      if (applied.length && rows.length)
        throw new Error('An applied favorite subscription lost its baseline');
      for (const row of rows)
        await runner.query(
          'INSERT INTO identity_favorite_watches (identityId,targetKind,targetId,generation,version,sourceAt,availableAt) VALUES (?,?,?,?,NULL,NULL,?)',
          [
            row.identityId,
            row.targetKind,
            row.targetId,
            randomUUID(),
            row.addedAt,
          ]
        );
      if (rows.length < 128) break;
    }
    for (const table of [
      'identity_favorite_watches',
      'identity_favorite_notifications',
    ]) {
      let identity = '',
        id = '';
      const key = table === 'identity_favorite_watches' ? 'generation' : 'id';
      for (;;) {
        const rows: Record<string, unknown>[] = await runner.query(
          `SELECT * FROM ${table} WHERE identityId>? OR (identityId=? AND ${key}>?) ORDER BY identityId,${key} LIMIT 128`,
          [identity, identity, id]
        );
        for (const row of rows) {
          if (key === 'generation') favoriteWatchRow(row);
          else favoriteUpdateReceiptRow(row);
          identity = String(row.identityId);
          id = String(row[key]);
        }
        if (rows.length < 128) break;
      }
    }
  }
  async down(): Promise<void> {
    throw new Error(
      'Favorite update rollback must preserve subscriptions, suppression receipts and erasure support'
    );
  }
}
