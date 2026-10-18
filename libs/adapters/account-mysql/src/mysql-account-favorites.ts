import { createHash, randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseFavoriteUpdateVersion,
  type FavoriteUpdateVersion,
  parseAccountFavorites,
  parseFavoriteChange,
  type AccountFavorites,
  type FavoriteChange,
  type FavoriteChangeReceipt,
} from '@domains/customer/favorites';
import {
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
  type CanonicalIdentityState,
} from '@sdk/features/identity/core';
import type { AccountFavoritesStore } from '@wapps/account';
import {
  appendCanonicalIdentityEvent,
  assertActiveIdentity,
  canonicalSqlInteger,
  canonicalSqlRequired,
  readCanonicalIdentity,
} from './canonical-account-sql';

export class MysqlAccountFavorites implements AccountFavoritesStore {
  constructor(
    private readonly source: DataSource,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID
  ) {}

  async read(uid: string): Promise<AccountFavorites> {
    this.identity(uid);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await readCanonicalIdentity(manager, uid);
      assertActiveIdentity(current);
      return this.snapshot(manager, current);
    });
  }

  async inspectChange(
    uid: string,
    input: FavoriteChange,
    key: string
  ): Promise<FavoriteChangeReceipt | null> {
    const change = this.input(uid, input, key);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const current = await readCanonicalIdentity(manager, uid);
      assertActiveIdentity(current);
      return this.receipt(manager, current, change, key);
    });
  }

  async change(
    uid: string,
    input: FavoriteChange,
    key: string,
    baseline: FavoriteUpdateVersion | null
  ): Promise<FavoriteChangeReceipt> {
    const change = this.input(uid, input, key);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const current = await readCanonicalIdentity(manager, uid, true);
      assertActiveIdentity(current);
      const receipt = await this.receipt(manager, current, change, key);
      if (receipt) return receipt;
      const at = Math.max(
        current.updatedAt,
        canonicalSqlInteger(this.now(), 1)
      );
      const revision = canonicalSqlInteger(current.revision + 1, 1);
      if (change.saved) {
        const { favorites } = await this.snapshot(manager, current);
        if (
          !favorites.some(
            (row) =>
              row.kind === change.target.kind && row.id === change.target.id
          )
        ) {
          if (favorites.length === ACCOUNT_FAVORITES_LIMIT)
            throw new CanonicalIdentityInputError('Favorite limit reached');
          const initial = parseFavoriteUpdateVersion(baseline);
          await manager.query(
            'INSERT INTO identity_favorite_watches (identityId,targetKind,targetId,generation,version,sourceAt,availableAt) VALUES (?,?,?,?,?,?,?)',
            [
              uid,
              change.target.kind,
              change.target.id,
              randomUUID(),
              initial.version,
              initial.at,
              at,
            ]
          );
          await manager.query(
            'INSERT INTO identity_favorites (identityId, targetKind, targetId, addedAt) VALUES (?, ?, ?, ?)',
            [uid, change.target.kind, change.target.id, at]
          );
        }
      } else {
        await manager.query(
          'DELETE FROM identity_favorite_watches WHERE identityId=? AND targetKind=? AND targetId=?',
          [uid, change.target.kind, change.target.id]
        );
        await manager.query(
          'DELETE FROM identity_favorites WHERE identityId = ? AND targetKind = ? AND targetId = ?',
          [uid, change.target.kind, change.target.id]
        );
      }
      await manager.query(
        'UPDATE identities SET revision = ?, updated_at = ? WHERE id = ?',
        [revision, at, current.subjectId]
      );
      await manager.query(
        'INSERT INTO identity_account_commands (identityId, commandKey, fingerprint, revision, createdAt) VALUES (?, ?, ?, ?, ?)',
        [uid, key, this.fingerprint(change), revision, at]
      );
      await appendCanonicalIdentityEvent(
        manager,
        'identity.updated',
        { ...current, revision, updatedAt: at },
        at,
        this.id
      );
      return { identityId: uid, revision };
    });
  }

  private async snapshot(
    manager: EntityManager,
    current: CanonicalIdentityState
  ): Promise<AccountFavorites> {
    const rows = await manager.query<
      { targetKind: unknown; targetId: unknown; addedAt: unknown }[]
    >(
      'SELECT targetKind, targetId, addedAt FROM identity_favorites WHERE identityId = ? ORDER BY addedAt, targetKind, targetId LIMIT ?',
      [current.identityId, ACCOUNT_FAVORITES_LIMIT + 1]
    );
    try {
      return parseAccountFavorites({
        identityId: current.identityId,
        revision: current.revision,
        favorites: rows.map((row) => {
          const addedAt = canonicalSqlInteger(row.addedAt, 1);
          canonicalSqlRequired(
            addedAt <= current.updatedAt,
            'Invalid favorite timestamp'
          );
          return { kind: row.targetKind, id: row.targetId, addedAt };
        }),
      });
    } catch {
      throw new CanonicalIdentityUnavailable('Invalid stored favorites');
    }
  }

  private async receipt(
    manager: EntityManager,
    current: CanonicalIdentityState,
    change: FavoriteChange,
    key: string
  ): Promise<FavoriteChangeReceipt | null> {
    const [receipt] = await manager.query<
      { fingerprint: string; revision: unknown }[]
    >(
      'SELECT fingerprint, revision FROM identity_account_commands WHERE identityId = ? AND commandKey = ?',
      [current.identityId, key]
    );
    if (receipt) {
      if (receipt.fingerprint !== this.fingerprint(change))
        throw new CanonicalIdentityConflict(
          'Idempotency-Key belongs to another command'
        );
      const revision = canonicalSqlInteger(receipt.revision, 2);
      canonicalSqlRequired(
        revision === change.expectedRevision + 1 &&
          revision <= current.revision,
        'Invalid favorite receipt revision'
      );
      return { identityId: current.identityId, revision };
    }
    if (current.revision !== change.expectedRevision)
      throw new CanonicalIdentityConflict(
        'Account revision changed. Reload before changing favorites.'
      );
    return null;
  }

  private fingerprint(change: FavoriteChange): string {
    return createHash('sha256')
      .update(JSON.stringify({ operation: 'favorite-change-v1', ...change }))
      .digest('hex');
  }

  private identity(uid: string): void {
    if (!isCanonicalIdentityId(uid))
      throw new CanonicalIdentityInputError('Invalid canonical identity ID');
  }

  private input(
    uid: string,
    input: FavoriteChange,
    key: string
  ): FavoriteChange {
    this.identity(uid);
    try {
      if (
        typeof key !== 'string' ||
        key.length < 1 ||
        key.length > 128 ||
        /[^\x21-\x7e]/.test(key)
      )
        throw new Error('Invalid key');
      return parseFavoriteChange(input);
    } catch {
      throw new CanonicalIdentityInputError(
        'Invalid favorite change or Idempotency-Key'
      );
    }
  }
}
