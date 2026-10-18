import { discussionKey } from '@sdk/features/discussion/core';
import { canReadDiscussion } from './discussion-access';
import {
  assertDiscussionBinding,
  type DiscussionBindingAccess,
} from './discussion-bindings.port';
import {
  DiscussionProjectionPendingError,
  DiscussionQueries,
} from './discussion-queries';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
  type DiscussionWriteRepository,
} from './discussion-write.port';

export interface DiscussionPageCursor {
  at: number;
  id: string;
  pinned?: boolean;
}

export type DiscussionOrder = 'created' | 'pinned';

export interface BoundDiscussionIndex {
  list(
    tenantId: string,
    bindingKey: string,
    actor: DiscussionActor | null,
    cursor: DiscussionPageCursor | null,
    order: DiscussionOrder
  ): Promise<DiscussionPageCursor[]>;
}

export interface DiscussionVoteTotals {
  upvotes: number;
  downvotes: number;
  mine: -1 | 0 | 1;
}

export interface BoundDiscussionVotes {
  read(
    id: string,
    revision: number,
    identityId: string | null
  ): Promise<Map<string, DiscussionVoteTotals>>;
}

/** Canonical access and structure are resolved before consumer payloads reach a BFF. */
export class BoundDiscussionQueries {
  constructor(
    private readonly queries: DiscussionQueries,
    private readonly writes: DiscussionWriteRepository,
    private readonly index: BoundDiscussionIndex,
    private readonly bindings: DiscussionBindingAccess,
    private readonly publicTenant: string,
    private readonly votes?: BoundDiscussionVotes
  ) {}

  async read(
    binding: string,
    id: string,
    actor: DiscussionActor | null,
    rootOnly = false,
    includeVotes = false
  ) {
    const key = discussionKey(binding);
    const result = await this.queries.findOne(id, actor, key, rootOnly);
    if (includeVotes && !this.votes)
      throw new Error('Discussion votes are unavailable');
    const votes = includeVotes
      ? await this.votes?.read(
          id,
          result.aggregate.revision,
          actor?.identityId ?? null
        )
      : undefined;
    const resources = await this.current(
      id,
      key,
      actor,
      result.aggregate.revision
    );
    if (resources.length !== result.aggregate.nodeCount)
      throw new DiscussionProjectionPendingError(
        'Discussion structure changed while reading'
      );
    const root = resources.find((resource) => resource.id === id);
    if (!root || typeof root.pinned !== 'boolean')
      throw new Error('Discussion pin authority is missing');
    const authority = new Map(
      resources.map((resource) => [resource.id, resource])
    );
    return {
      id,
      bindingKey: key,
      revision: result.aggregate.revision,
      replyCount: resources.length - 1,
      pinned: root.pinned,
      canPin: actor?.roles.includes('admin') === true,
      comments: result.nodes.map((node) => {
        const resource = authority.get(node.id);
        if (!resource) throw new Error('Discussion authority is incomplete');
        const live =
          canReadDiscussion(resource, actor) && !('redacted' in node);
        if (votes && !votes.has(node.id))
          throw new Error('Discussion votes are incomplete');
        let content: unknown = null;
        if (live) {
          if (
            !node.payload ||
            typeof node.payload !== 'object' ||
            !('content' in node.payload)
          )
            throw new Error('Discussion payload is incomplete');
          content = node.payload.content;
        }
        return {
          id: node.id,
          parentId: node.parentId,
          depth: node.depth,
          content,
          ...(votes ? { votes: live ? votes.get(node.id) : null } : {}),
          createdAt: live && 'createdAt' in node ? node.createdAt : null,
          updatedAt: live && 'updatedAt' in node ? node.updatedAt : null,
          editable: live && actor?.identityId === resource.ownerIdentityId,
          removable:
            live &&
            !!actor &&
            (actor.identityId === resource.ownerIdentityId ||
              actor.roles.includes('admin')),
        };
      }),
    };
  }

  async list(
    binding: string,
    actor: DiscussionActor | null,
    cursor: DiscussionPageCursor | null,
    order: DiscussionOrder,
    includeVotes = false
  ) {
    const key = discussionKey(binding);
    const tenant = actor?.tenantId ?? this.publicTenant;
    await assertDiscussionBinding(key, key, tenant, this.bindings);
    const rows = await this.index.list(tenant, key, actor, cursor, order);
    if (
      rows.length > 11 ||
      new Set(rows.map((row) => row.id)).size !== rows.length
    )
      throw new Error('Invalid discussion page');
    const items: Awaited<ReturnType<BoundDiscussionQueries['read']>>[] = [];
    for (const row of rows.slice(0, 10)) {
      try {
        const item = await this.read(key, row.id, actor, true, includeVotes);
        if (order === 'pinned' && item.pinned !== row.pinned)
          throw new DiscussionProjectionPendingError(
            'Discussion order changed while reading'
          );
        items.push(item);
      } catch (error) {
        if (error instanceof DiscussionNotFoundError)
          throw new DiscussionProjectionPendingError(
            'Discussion page changed while reading'
          );
        throw error;
      }
    }
    if (
      JSON.stringify(rows) !==
      JSON.stringify(await this.index.list(tenant, key, actor, cursor, order))
    )
      throw new DiscussionProjectionPendingError(
        'Discussion order changed while reading'
      );
    await assertDiscussionBinding(key, key, tenant, this.bindings);
    for (const item of items)
      await this.current(item.id, key, actor, item.revision);
    return { items, next: rows.length > 10 ? rows[9] : null };
  }

  private async current(
    id: string,
    key: string,
    actor: DiscussionActor | null,
    revision: number
  ) {
    const tenant = actor?.tenantId ?? this.publicTenant;
    await assertDiscussionBinding(key, key, tenant, this.bindings);
    // Parent checks can perform remote I/O. Finish against current canonical local authority.
    const resources = await this.writes.resources(id);
    const root = resources.find((resource) => resource.id === id);
    if (
      !root ||
      root.tenantId !== tenant ||
      root.bindingKey !== key ||
      !canReadDiscussion(root, actor)
    )
      throw new DiscussionNotFoundError('Discussion not found');
    if (
      root.revision !== revision ||
      resources.some(
        (resource) =>
          resource.revision !== revision || resource.bindingKey !== key
      )
    )
      throw new DiscussionProjectionPendingError(
        'Discussion changed while reading'
      );
    return resources;
  }
}
