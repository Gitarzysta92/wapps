import {
  permitsContent,
  type ClassifiedContent,
} from '@domains/publication/classification';
import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  favoriteUpdateId,
  favoriteUpdateTime,
  parseFavoriteTarget,
  parseFavoriteUpdateState,
  parseFavoriteUpdateVersion,
  type FavoriteUpdateState,
  type favoriteUpdateCursor,
} from '@domains/customer/favorites';
import {
  defaultAccountPreferences,
  parseAccountPreferences,
} from '@domains/customer/preferences';
import {
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
  type CanonicalIdentityState,
} from '@sdk/features/identity/core';
import type {
  FavoriteUpdateLease,
  FavoriteUpdateReceipt,
  FavoriteUpdatesStore,
  FavoriteUpdateSnapshot,
} from '@wapps/account';
import {
  assertActiveIdentity,
  canonicalSqlInteger as integer,
  readCanonicalIdentity,
} from './canonical-account-sql';

type Row = Record<string, unknown>;
function identity(value: unknown): string {
  if (!isCanonicalIdentityId(value)) throw new Error('Invalid update identity');
  return value;
}
export function favoriteWatchRow(row: Row) {
  const lease: FavoriteUpdateLease = {
    identityId: identity(row.identityId),
    target: parseFavoriteTarget({ kind: row.targetKind, id: row.targetId }),
    generation: favoriteUpdateId(row.generation),
    token: row.leaseToken === null ? '' : favoriteUpdateId(row.leaseToken),
  };
  const version =
    row.version === null
      ? null
      : parseFavoriteUpdateVersion({
          version: integer(row.version),
          at: integer(row.sourceAt),
        });
  const availableAt = favoriteUpdateTime(integer(row.availableAt)),
    attempts = integer(row.attempts);
  const until =
    row.leasedUntil === null
      ? null
      : favoriteUpdateTime(integer(row.leasedUntil));
  const failedAt =
    row.failedAt === null ? null : favoriteUpdateTime(integer(row.failedAt));
  if (
    (row.version === null) !== (row.sourceAt === null) ||
    attempts > 12 ||
    (lease.token === '') !== (until === null) ||
    (until !== null && attempts === 0) ||
    (failedAt !== null && (attempts !== 12 || until !== null))
  )
    throw new Error('Invalid favorite watch');
  return { lease, version, availableAt, attempts, until, failedAt };
}
export function favoriteUpdateReceiptRow(row: Row): FavoriteUpdateReceipt {
  identity(row.identityId);
  const at = favoriteUpdateTime(integer(row.createdAt)),
    sourceAt = favoriteUpdateTime(integer(row.sourceAt));
  const readAt =
    row.readAt === null ? null : favoriteUpdateTime(integer(row.readAt));
  if (
    ![0, 1].includes(Number(row.delivered)) ||
    at < sourceAt ||
    (readAt !== null && (row.delivered !== 1 || readAt < at))
  )
    throw new Error('Invalid update receipt');
  return {
    id: favoriteUpdateId(row.id),
    generation: favoriteUpdateId(row.generation),
    target: parseFavoriteTarget({ kind: row.targetKind, id: row.targetId }),
    version: integer(row.version, 1),
    at,
    readAt,
  };
}

export class MysqlFavoriteUpdates implements FavoriteUpdatesStore {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}
  claim(): Promise<FavoriteUpdateLease | null> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const at = favoriteUpdateTime(this.now());
      const [row]: Row[] = await tx.query(
        'SELECT * FROM identity_favorite_watches WHERE failedAt IS NULL AND availableAt<=? AND (leasedUntil IS NULL OR leasedUntil<=?) ORDER BY availableAt,generation LIMIT 1 FOR UPDATE SKIP LOCKED',
        [at, at]
      );
      if (!row) return null;
      const value = favoriteWatchRow(row);
      if (value.attempts === 12) {
        await tx.query(
          'UPDATE identity_favorite_watches SET failedAt=?,leaseToken=NULL,leasedUntil=NULL WHERE generation=?',
          [at, value.lease.generation]
        );
        return null;
      }
      const token = randomUUID();
      await tx.query(
        'UPDATE identity_favorite_watches SET attempts=?,leaseToken=?,leasedUntil=? WHERE generation=?',
        [value.attempts + 1, token, at + 30_000, value.lease.generation]
      );
      return { ...value.lease, token };
    });
  }
  async settle(
    lease: FavoriteUpdateLease,
    input: FavoriteUpdateState
  ): Promise<void> {
    const state = parseFavoriteUpdateState(input);
    if (
      state.target.id !== lease.target.id ||
      state.target.kind !== lease.target.kind
    )
      throw new Error('Update scope differs');
    await this.source.transaction('READ COMMITTED', async (tx) => {
      const account = await readCanonicalIdentity(
        tx,
        identity(lease.identityId),
        true
      );
      if (!account || account.isDeleted) return;
      const value = await this.lockLease(tx, lease);
      if (!value) return;
      const [favorite]: Row[] = await tx.query(
        'SELECT addedAt FROM identity_favorites WHERE identityId=? AND targetKind=? AND targetId=?',
        [lease.identityId, lease.target.kind, lease.target.id]
      );
      if (!favorite)
        throw new Error('Favorite subscription lost its membership');
      if (
        value.version &&
        (state.version < value.version.version || state.at < value.version.at)
      )
        throw new Error('Content update authority regressed');
      if (value.version && state.version > value.version.version) {
        const delivered =
          account.isActive &&
          !account.isSuspended &&
          state.content !== null &&
          (await this.enabled(tx, account, state.content));
        const at = Math.max(
          state.at,
          account.updatedAt,
          integer(this.now(), 1)
        );
        await tx.query(
          'INSERT INTO identity_favorite_notifications (identityId,id,generation,targetKind,targetId,version,sourceAt,createdAt,delivered,readAt) VALUES (?,?,?,?,?,?,?,?,?,NULL)',
          [
            lease.identityId,
            randomUUID(),
            lease.generation,
            lease.target.kind,
            lease.target.id,
            state.version,
            state.at,
            at,
            delivered ? 1 : 0,
          ]
        );
      }
      // Receipt and observation commit together; no source acknowledgement can lose an update.
      await tx.query(
        'UPDATE identity_favorite_watches SET version=?,sourceAt=?,attempts=0,availableAt=?,leaseToken=NULL,leasedUntil=NULL WHERE generation=?',
        [state.version, state.at, this.now() + 30_000, lease.generation]
      );
    });
  }
  async fail(lease: FavoriteUpdateLease): Promise<void> {
    await this.source.transaction('READ COMMITTED', async (tx) => {
      const value = await this.lockLease(tx, lease);
      if (!value) return;
      const at = this.now();
      await tx.query(
        'UPDATE identity_favorite_watches SET availableAt=?,failedAt=?,leaseToken=NULL,leasedUntil=NULL WHERE generation=?',
        [
          at + Math.min(300_000, 1000 * 2 ** value.attempts),
          value.attempts === 12 ? at : null,
          lease.generation,
        ]
      );
    });
  }
  private async lockLease(tx: EntityManager, lease: FavoriteUpdateLease) {
    const [row]: Row[] = await tx.query(
      'SELECT * FROM identity_favorite_watches WHERE identityId=? AND generation=? FOR UPDATE',
      [identity(lease.identityId), favoriteUpdateId(lease.generation)]
    );
    if (!row) return null;
    const value = favoriteWatchRow(row);
    if (
      value.lease.token !== favoriteUpdateId(lease.token) ||
      value.until === null ||
      value.until <= this.now() ||
      value.failedAt !== null
    )
      return null;
    if (
      value.lease.target.kind !== lease.target.kind ||
      value.lease.target.id !== lease.target.id
    )
      throw new Error('Update lease scope differs');
    return value;
  }
  list(uid: string, cursor: ReturnType<typeof favoriteUpdateCursor>) {
    return this.snapshot(
      uid,
      cursor ? 'AND (n.createdAt<? OR (n.createdAt=? AND n.id<?))' : '',
      cursor ? [cursor.at, cursor.at, cursor.id] : []
    );
  }
  current(uid: string, ids: string[]) {
    if (ids.length > 10 || new Set(ids).size !== ids.length)
      throw new Error('Update selection exceeds bounds');
    return this.snapshot(
      uid,
      ids.length ? `AND n.id IN (${ids.map(() => '?').join(',')})` : 'AND 1=0',
      ids.map(favoriteUpdateId)
    );
  }
  private snapshot(
    uid: string,
    filter: string,
    args: (string | number)[]
  ): Promise<FavoriteUpdateSnapshot> {
    identity(uid);
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const account = await readCanonicalIdentity(tx, uid);
      assertActiveIdentity(account);
      const enabled = await this.enabled(tx, account);
      if (!enabled) return { revision: account.revision, enabled, entries: [] };
      const rows: Row[] = await tx.query(
        `SELECT n.* FROM identity_favorite_notifications n
        JOIN identity_favorite_watches w ON w.identityId=n.identityId AND w.generation=n.generation AND w.targetKind=n.targetKind AND w.targetId=n.targetId
        JOIN identity_favorites f ON f.identityId=w.identityId AND f.targetKind=w.targetKind AND f.targetId=w.targetId
        WHERE n.identityId=? AND n.delivered=1 ${filter} ORDER BY n.createdAt DESC,n.id DESC LIMIT 11`,
        [uid, ...args]
      );
      return {
        revision: account.revision,
        enabled,
        showMatureContent: (await this.preferences(tx, account)).content
          .showMatureContent,
        entries: rows.map(favoriteUpdateReceiptRow),
      };
    });
  }
  markRead(uid: string, id: string): Promise<{ id: string; readAt: number }> {
    identity(uid);
    favoriteUpdateId(id);
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const account = await readCanonicalIdentity(tx, uid, true);
      assertActiveIdentity(account);
      if (!(await this.enabled(tx, account)))
        throw new CanonicalIdentityInputError('Favorite updates are disabled');
      const [row]: Row[] = await tx.query(
        `SELECT n.* FROM identity_favorite_notifications n JOIN identity_favorite_watches w ON w.identityId=n.identityId AND w.generation=n.generation WHERE n.identityId=? AND n.id=? AND n.delivered=1`,
        [uid, id]
      );
      if (!row)
        throw new CanonicalIdentityInputError('Favorite update is unavailable');
      const record = favoriteUpdateReceiptRow(row),
        readAt = record.readAt ?? Math.max(record.at, integer(this.now(), 1));
      if (record.readAt === null)
        await tx.query(
          'UPDATE identity_favorite_notifications SET readAt=? WHERE identityId=? AND id=? AND readAt IS NULL',
          [readAt, uid, id]
        );
      return { id, readAt };
    });
  }
  async status() {
    const counts: Row[] = await this.source.query(
      "SELECT CASE WHEN failedAt IS NOT NULL THEN 'failed' WHEN leasedUntil>? THEN 'leased' ELSE 'pending' END state,COUNT(*) total FROM identity_favorite_watches GROUP BY state",
      [this.now()]
    );
    const failed: Row[] = await this.source.query(
      'SELECT generation,failedAt,attempts FROM identity_favorite_watches WHERE failedAt IS NOT NULL ORDER BY failedAt,generation LIMIT 50'
    );
    return {
      counts: counts.map((row) => ({
        state: row.state,
        total: integer(row.total),
      })),
      failed: failed.map((row) => ({
        generation: favoriteUpdateId(row.generation),
        failedAt: integer(row.failedAt, 1),
        attempts: integer(row.attempts),
      })),
      failurePageLimit: 50,
    };
  }
  async requeue(generation: string, failedAt: number): Promise<boolean> {
    favoriteUpdateId(generation);
    favoriteUpdateTime(failedAt);
    if (failedAt < 1) throw new Error('An exact failure receipt is required');
    const result = await this.source.query(
      'UPDATE identity_favorite_watches SET attempts=0,failedAt=NULL,availableAt=? WHERE generation=? AND failedAt=? AND leaseToken IS NULL',
      [this.now(), generation, failedAt]
    );
    return result.affectedRows === 1;
  }
  private async enabled(
    tx: EntityManager,
    account: CanonicalIdentityState,
    content?: ClassifiedContent
  ): Promise<boolean> {
    const saved = await this.preferences(tx, account);
    return (
      saved.notifications.inApp.enabled &&
      saved.notifications.inApp.favoriteUpdates &&
      (content === undefined ||
        permitsContent(content, saved.content.showMatureContent))
    );
  }
  private async preferences(
    tx: EntityManager,
    account: CanonicalIdentityState
  ) {
    const [row]: Row[] = await tx.query(
      'SELECT preferences,updatedAt FROM identity_preferences WHERE identityId=?',
      [account.identityId]
    );
    const updatedAt = row ? integer(row.updatedAt, 1) : null;
    if (updatedAt !== null && updatedAt > account.updatedAt)
      throw new Error('Invalid preference authority');
    const saved = parseAccountPreferences({
      identityId: account.identityId,
      revision: account.revision,
      updatedAt,
      preferences: row
        ? typeof row.preferences === 'string'
          ? JSON.parse(row.preferences)
          : row.preferences
        : defaultAccountPreferences(),
    });
    return saved.preferences;
  }
}
