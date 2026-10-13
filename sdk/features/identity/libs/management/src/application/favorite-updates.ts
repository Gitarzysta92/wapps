import {
  favoriteUpdateCursor,
  favoriteUpdateId,
  favoriteUpdateObject,
  parseFavoriteUpdateState,
  type FavoriteTarget,
  type FavoriteUpdateState,
  type FavoriteUpdatePage,
} from '@domains/customer/favorites';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import type { IdentityManagementContext } from './models/identity-management-context';
import type { FavoriteUpdateSource } from './favorite-update-source';

export interface FavoriteUpdateLease {
  identityId: string;
  target: FavoriteTarget;
  generation: string;
  token: string;
}
export interface FavoriteUpdateReceipt {
  id: string;
  target: FavoriteTarget;
  generation: string;
  version: number;
  at: number;
  readAt: number | null;
}
export interface FavoriteUpdateSnapshot {
  revision: number;
  enabled: boolean;
  entries: FavoriteUpdateReceipt[];
}
export interface FavoriteUpdatesStore {
  claim(): Promise<FavoriteUpdateLease | null>;
  settle(lease: FavoriteUpdateLease, state: FavoriteUpdateState): Promise<void>;
  fail(lease: FavoriteUpdateLease): Promise<void>;
  list(
    identityId: string,
    cursor: ReturnType<typeof favoriteUpdateCursor>
  ): Promise<FavoriteUpdateSnapshot>;
  current(identityId: string, ids: string[]): Promise<FavoriteUpdateSnapshot>;
  markRead(
    identityId: string,
    id: string
  ): Promise<{ id: string; readAt: number }>;
}

export class DeliverFavoriteUpdates {
  constructor(
    private readonly store: FavoriteUpdatesStore,
    private readonly source: FavoriteUpdateSource
  ) {}
  async advance(): Promise<boolean> {
    const lease = await this.store.claim();
    if (!lease) return false;
    try {
      const state = parseFavoriteUpdateState(
        await this.source.read(lease.target)
      );
      if (
        state.target.kind !== lease.target.kind ||
        state.target.id !== lease.target.id
      )
        throw new Error('Favorite update scope differs');
      await this.store.settle(lease, state);
      return true;
    } catch (error) {
      await this.store.fail(lease);
      throw error;
    }
  }
}

export class FavoriteUpdatesService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: FavoriteUpdatesStore,
    private readonly source: FavoriteUpdateSource,
    private readonly available: () => boolean
  ) {}
  list(
    query: unknown,
    context: IdentityManagementContext
  ): Promise<Result<FavoriteUpdatePage, Error>> {
    return this.run('identity.notifications.read', context, async () => {
      if (!this.available())
        throw new CanonicalIdentityUnavailable(
          'Favorite update delivery is not enabled'
        );
      let cursor;
      try {
        if (
          !query ||
          typeof query !== 'object' ||
          Array.isArray(query) ||
          Object.keys(query).some((key) => key !== 'cursor')
        )
          throw new Error();
        cursor = favoriteUpdateCursor(
          Object.fromEntries(Object.entries(query))['cursor']
        );
      } catch {
        throw new CanonicalIdentityInputError('Invalid update cursor');
      }
      const page = await this.store.list(context.identityId, cursor);
      if (!page.enabled) return { enabled: false, items: [], next: null };
      if (page.entries.length > 11)
        throw new Error('Update page exceeds bounds');
      const scanned = page.entries.slice(0, 10),
        states = new Map<string, FavoriteUpdateState>();
      const targets = new Map(
        scanned.map((row) => [
          `${row.target.kind}:${row.target.id}`,
          row.target,
        ])
      );
      await Promise.all(
        [...targets].map(async ([key, target]) => {
          const state = parseFavoriteUpdateState(
            await this.source.read(target)
          );
          if (
            state.target.kind !== target.kind ||
            state.target.id !== target.id
          )
            throw new Error('Favorite update scope differs');
          states.set(key, state);
        })
      );
      const current = await this.store.current(
        context.identityId,
        scanned.map((row) => row.id)
      );
      if (!current.enabled) return { enabled: false, items: [], next: null };
      if (page.revision !== current.revision)
        throw new CanonicalIdentityConflict(
          'Account changed; refresh favorite updates'
        );
      const items: FavoriteUpdatePage['items'] = [];
      for (const candidate of scanned) {
        const row = current.entries.find((row) => row.id === candidate.id),
          state = states.get(`${candidate.target.kind}:${candidate.target.id}`);
        if (!row || !state?.content) continue;
        if (
          row.version !== candidate.version ||
          row.generation !== candidate.generation ||
          row.target.id !== candidate.target.id ||
          row.target.kind !== candidate.target.kind ||
          row.at !== candidate.at ||
          state.version < row.version
        )
          throw new Error('Favorite update authority differs');
        items.push({
          id: row.id,
          target: row.target,
          ...state.content,
          at: row.at,
          readAt: row.readAt,
        });
      }
      const last = scanned[scanned.length - 1];
      return {
        enabled: true,
        items,
        next: page.entries.length > 10 ? `${last.at}.${last.id}` : null,
      };
    });
  }
  markRead(input: unknown, context: IdentityManagementContext) {
    return this.run('identity.notifications.update', context, async () => {
      if (!this.available())
        throw new CanonicalIdentityUnavailable(
          'Favorite update delivery is not enabled'
        );
      let id;
      try {
        id = favoriteUpdateId(favoriteUpdateObject(input, ['id'])['id']);
      } catch {
        throw new CanonicalIdentityInputError('Invalid update ID');
      }
      return this.store.markRead(context.identityId, id);
    });
  }
  private async run<T>(
    actionName: string,
    context: IdentityManagementContext,
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      if (!isCanonicalIdentityId(context.identityId))
        throw new CanonicalIdentityAccessDenied('Authentication required');
      const decision = await this.authority.validate({
        ...context,
        actionName,
        timestamp: Date.now(),
        resource: { type: 'user', id: context.identityId },
      });
      if (!decision.ok)
        throw new CanonicalIdentityUnavailable(
          'Update authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Update access denied');
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityConflict ||
          error instanceof CanonicalIdentityInputError ||
          error instanceof CanonicalIdentityUnavailable
          ? error
          : new CanonicalIdentityUnavailable('Favorite updates unavailable')
      );
    }
  }
}
