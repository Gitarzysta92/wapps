import { discussionKey } from '@sdk/features/discussion/core';
import {
  BoundDiscussionQueries,
  type DiscussionPageCursor,
} from './bound-discussion-queries';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
  type DiscussionResource,
  type DiscussionWriteRepository,
} from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';
import {
  assertDiscussionBinding,
  type DiscussionBindingAccess,
} from './discussion-bindings.port';
import { canReadDiscussion } from './discussion-access';

export interface DiscussionParticipation extends DiscussionPageCursor {
  bindingKey: string;
  revision: number;
  participation: 'author' | 'participant';
}

export interface DiscussionParticipationIndex {
  list(
    actor: DiscussionActor,
    prefix: string,
    cursor: DiscussionPageCursor | null
  ): Promise<DiscussionParticipation[]>;
  current(
    actor: DiscussionActor,
    prefix: string,
    ids: string[]
  ): Promise<DiscussionParticipation[]>;
}

export class DiscussionDiscovery {
  constructor(
    private readonly reader: BoundDiscussionQueries,
    private readonly writes: DiscussionWriteRepository,
    private readonly bindings: DiscussionBindingAccess,
    private readonly index: DiscussionParticipationIndex,
    private readonly authorizeParticipation: (
      actor: DiscussionActor
    ) => Promise<void>,
    private readonly publicTenant: string
  ) {}

  async participation(
    actor: DiscussionActor,
    prefix: string,
    cursor: DiscussionPageCursor | null,
    includeVotes: boolean
  ) {
    discussionKey(prefix);
    await this.authorizeParticipation(actor);
    const candidates = await this.index.list(actor, prefix, cursor);
    if (
      candidates.length > 11 ||
      new Set(candidates.map((row) => row.id)).size !== candidates.length
    )
      throw new Error('Invalid discussion membership page');
    const loaded: Array<{
      thread: Awaited<ReturnType<BoundDiscussionQueries['read']>>;
      at: number;
      participation: DiscussionParticipation['participation'];
    }> = [];
    for (const candidate of candidates.slice(0, 10)) {
      if (!candidate.bindingKey.startsWith(prefix))
        throw new Error('Invalid discussion membership scope');
      try {
        const thread = await this.reader.read(
          candidate.bindingKey,
          candidate.id,
          actor,
          true,
          includeVotes
        );
        loaded.push({
          thread,
          at: candidate.at,
          participation: candidate.participation,
        });
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    const current = new Map(
      (
        await this.index.current(
          actor,
          prefix,
          loaded.map((row) => row.thread.id)
        )
      ).map((row) => [row.id, row])
    );
    const items: typeof loaded = [];
    for (const item of loaded) {
      const authority = current.get(item.thread.id);
      if (!authority) continue;
      if (
        authority.bindingKey !== item.thread.bindingKey ||
        authority.revision !== item.thread.revision ||
        authority.at !== item.at
      )
        throw new DiscussionProjectionPendingError(
          'Discussion membership changed while reading'
        );
      try {
        await this.current(item.thread, actor);
        items.push({ ...item, participation: authority.participation });
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    const last = candidates[9];
    return {
      items,
      next: candidates.length > 10 ? `${last.at}.${last.id}` : null,
    };
  }

  async selection(ids: string[], prefix: string, includeVotes: boolean) {
    discussionKey(prefix);
    const loaded: Awaited<ReturnType<BoundDiscussionQueries['read']>>[] = [];
    for (const id of ids) {
      const resource = await this.writes.resource(id);
      if (!this.publicRoot(resource, prefix)) continue;
      try {
        loaded.push(
          await this.reader.read(
            resource.bindingKey,
            id,
            null,
            true,
            includeVotes
          )
        );
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    const items: typeof loaded = [];
    for (const item of loaded) {
      try {
        await this.current(item, null);
        const resource = await this.writes.resource(item.id);
        if (!this.publicRoot(resource, prefix)) continue;
        if (
          resource.revision !== item.revision ||
          resource.bindingKey !== item.bindingKey
        )
          throw new DiscussionProjectionPendingError(
            'Discussion selection changed while reading'
          );
        items.push(item);
      } catch (error) {
        if (!(error instanceof DiscussionNotFoundError)) throw error;
      }
    }
    return { items };
  }

  private publicRoot(
    resource: DiscussionResource | null,
    prefix: string
  ): resource is DiscussionResource & { bindingKey: string } {
    return (
      !!resource &&
      resource.kind === 'discussion' &&
      resource.id === resource.discussionId &&
      resource.tenantId === this.publicTenant &&
      typeof resource.bindingKey === 'string' &&
      resource.bindingKey.startsWith(prefix) &&
      resource.state === 'published' &&
      resource.visibility === 'public' &&
      resource.deletedAt === null &&
      resource.rootDeletedAt === null &&
      resource.rootState === 'published' &&
      resource.rootVisibility === 'public'
    );
  }

  private async current(
    item: { id: string; bindingKey: string; revision: number },
    actor: DiscussionActor | null
  ) {
    await assertDiscussionBinding(
      item.bindingKey,
      item.bindingKey,
      actor?.tenantId ?? this.publicTenant,
      this.bindings
    );
    const current = await this.writes.resource(item.id);
    if (!current || !canReadDiscussion(current, actor))
      throw new DiscussionNotFoundError('Discussion not found');
    if (
      current.revision !== item.revision ||
      current.bindingKey !== item.bindingKey ||
      current.tenantId !== (actor?.tenantId ?? this.publicTenant)
    )
      throw new DiscussionProjectionPendingError(
        'Discussion changed while reading'
      );
  }
}
