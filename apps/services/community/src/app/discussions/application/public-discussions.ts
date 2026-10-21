import {
  commentObject,
  boundDiscussionContent,
  publicCommentId,
  PublicCommentInputError,
  applicationDiscussionCursor,
  type DiscussionTarget,
  type PublicCommentThread,
} from '@domains/community';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import {
  DiscussionQueries,
  DiscussionProjectionPendingError,
} from './discussion-queries';
import {
  assertDiscussionTarget,
  type DiscussionTargets,
} from './discussion-targets.port';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
  type DiscussionWriteRepository,
  type DiscussionResource,
} from './discussion-write.port';
import type { DiscussionVotesReader } from './discussion-votes.port';
import { canReadDiscussion } from './discussion-access';
import { ANONYMOUS_DISCUSSION_NAME } from './discussion-anonymity';

export interface PublicDiscussionCursor {
  at: number;
  id: string;
  pinned?: boolean;
}
export interface PublicDiscussionIndex {
  list(
    tenantId: string,
    targetId: string,
    cursor: PublicDiscussionCursor | null
  ): Promise<PublicDiscussionCursor[]>;
}

export class PublicDiscussions<T extends PublicCommentThread> {
  constructor(
    protected readonly commands: DurableDiscussionCommands,
    private readonly queries: DiscussionQueries,
    private readonly writes: DiscussionWriteRepository,
    private readonly threads: PublicDiscussionIndex,
    private readonly targets: DiscussionTargets,
    private readonly publicTenant: string,
    private readonly presentation: {
      kind: DiscussionTarget['kind'];
      thread: (
        base: PublicCommentThread,
        root: unknown,
        resource: DiscussionResource,
        actor: DiscussionActor | null
      ) => T;
    },
    private readonly votes?: DiscussionVotesReader
  ) {}

  async list(
    targetId: string,
    query: unknown,
    actor: DiscussionActor | null
  ): Promise<{ items: T[]; next: string | null }> {
    const target = this.target(targetId),
      tenant = actor?.tenantId ?? this.publicTenant;
    const input = commentObject(query, ['cursor']);
    let cursor: PublicDiscussionCursor | null = null;
    if (input['cursor'] !== undefined) {
      if (this.presentation.kind === 'application') {
        cursor = applicationDiscussionCursor(input['cursor']);
      } else {
        if (typeof input['cursor'] !== 'string' || input['cursor'].length > 60)
          throw new PublicCommentInputError('Invalid comments cursor');
        const [at, id, extra] = input['cursor'].split('.');
        if (
          extra !== undefined ||
          !/^\d{1,16}$/.test(at) ||
          !Number.isSafeInteger(Number(at))
        )
          throw new PublicCommentInputError('Invalid comments cursor');
        cursor = { at: Number(at), id: publicCommentId(id) };
      }
    }
    await assertDiscussionTarget(target, target, tenant, this.targets);
    const rows = await this.threads.list(tenant, target.id, cursor);
    if (rows.length > 11)
      throw new Error('Discussion topics exceed page bounds');
    const items: T[] = [];
    for (const row of rows.slice(0, 10)) {
      try {
        const item = await this.read(targetId, row.id, actor, true);
        if (
          this.presentation.kind === 'application' &&
          (!('pinned' in item) || item.pinned !== row.pinned)
        )
          throw new DiscussionProjectionPendingError(
            'Discussion order changed while loading'
          );
        items.push(item);
      } catch (error) {
        if (error instanceof DiscussionNotFoundError)
          throw new DiscussionProjectionPendingError(
            'Discussion topics changed while loading'
          );
        throw error;
      }
    }
    if (
      this.presentation.kind === 'application' &&
      JSON.stringify(rows) !==
        JSON.stringify(await this.threads.list(tenant, target.id, cursor))
    )
      throw new DiscussionProjectionPendingError(
        'Discussion order changed while loading'
      );
    await assertDiscussionTarget(target, target, tenant, this.targets);
    const currentPages = await Promise.all(
      items.map((item) => this.writes.resources(item.id))
    );
    for (const [index, resources] of currentPages.entries()) {
      const item = items[index];
      const root = resources.find((resource) => resource.id === item.id);
      if (
        !root ||
        root.tenantId !== tenant ||
        !canReadDiscussion(root, actor) ||
        resources.some((resource) => resource.revision !== item.revision)
      )
        throw new DiscussionProjectionPendingError(
          'Discussion topics changed while loading'
        );
    }
    const last = rows[9];
    return {
      items,
      next:
        rows.length > 10
          ? `${
              this.presentation.kind === 'application'
                ? `${last.pinned ? 1 : 0}.`
                : ''
            }${last.at}.${last.id}`
          : null,
    };
  }

  async read(
    targetId: string,
    id: string,
    actor: DiscussionActor | null,
    rootOnly = false
  ): Promise<T> {
    const target = this.target(targetId),
      threadId = publicCommentId(id);
    const result = await this.queries.findOne(
      threadId,
      actor,
      target,
      rootOnly
    );
    const votes = this.votes
      ? await this.votes.read(
          threadId,
          result.aggregate.revision,
          actor?.identityId ?? null
        )
      : undefined;
    let resources = await this.writes.resources(threadId);
    let currentRoot = resources.find((resource) => resource.id === threadId);
    if (
      !currentRoot ||
      currentRoot.tenantId !== (actor?.tenantId ?? this.publicTenant) ||
      !canReadDiscussion(currentRoot, actor)
    )
      throw new DiscussionNotFoundError('Discussion not found');
    await assertDiscussionTarget(
      currentRoot.target,
      target,
      actor?.tenantId ?? this.publicTenant,
      this.targets
    );
    // Target eligibility performs external I/O; finish with current local authority.
    resources = await this.writes.resources(threadId);
    currentRoot = resources.find((resource) => resource.id === threadId);
    if (
      !currentRoot ||
      currentRoot.tenantId !== (actor?.tenantId ?? this.publicTenant) ||
      !canReadDiscussion(currentRoot, actor)
    )
      throw new DiscussionNotFoundError('Discussion not found');
    if (
      resources.some(
        (resource) => resource.revision !== result.aggregate.revision
      )
    )
      throw new DiscussionProjectionPendingError(
        'Discussion topics changed while loading'
      );
    const authority = new Map(
      resources.map((resource) => [resource.id, resource])
    );
    const thread: PublicCommentThread = {
      id: threadId,
      revision: result.aggregate.revision,
      // Removed replies remain structural entries that readers can open.
      replyCount: resources.length - 1,
      comments: result.nodes.map((node) => {
        const resource = authority.get(node.id);
        if (!resource) throw new Error('Comment authority is incomplete');
        const live =
          canReadDiscussion(resource, actor) && !('redacted' in node);
        if (votes && !votes.has(node.id))
          throw new Error('Discussion votes are incomplete');
        let content = null;
        if (live) {
          try {
            const parsed = boundDiscussionContent(
              target,
              resource.kind,
              commentObject(node.payload, ['content'])['content']
            );
            content = {
              displayName:
                resource.ownerIdentityId === null
                  ? ANONYMOUS_DISCUSSION_NAME
                  : parsed.displayName,
              text: parsed.text,
              ...(parsed.mentions?.length ? { mentions: parsed.mentions } : {}),
            };
          } catch {
            throw new Error('Discussion topic projection is invalid');
          }
        }
        return {
          id: node.id,
          parentId: node.parentId,
          depth: node.depth,
          content,
          ...(votes ? { votes: live ? votes.get(node.id) : null } : {}),
          createdAt: 'createdAt' in node && live ? node.createdAt : null,
          updatedAt: 'updatedAt' in node && live ? node.updatedAt : null,
          editable: live && actor?.identityId === resource.ownerIdentityId,
          removable:
            live &&
            !!actor &&
            (actor.identityId === resource.ownerIdentityId ||
              actor.roles.includes('admin')),
        };
      }),
    };
    const root = result.nodes.find((node) => node.id === threadId);
    return this.presentation.thread(
      thread,
      root ? commentObject(root.payload, ['content'])['content'] : undefined,
      currentRoot,
      actor
    );
  }

  create(targetId: string, body: unknown, actor: DiscussionActor, key: string) {
    const target = this.target(targetId);
    return this.commands.create(
      {
        content: boundDiscussionContent(target, 'discussion', body),
        subjectId: target.id,
        target,
      },
      actor,
      key
    );
  }

  reply(
    targetId: string,
    parentId: string,
    body: unknown,
    actor: DiscussionActor,
    key: string
  ) {
    return this.commands.reply(
      publicCommentId(parentId),
      boundDiscussionContent(this.target(targetId), 'comment', body),
      actor,
      key,
      this.target(targetId)
    );
  }

  edit(
    targetId: string,
    id: string,
    body: unknown,
    actor: DiscussionActor,
    key: string
  ) {
    const input = commentObject(body, ['content', 'expectedRevision']);
    if (
      !Number.isSafeInteger(input['expectedRevision']) ||
      Number(input['expectedRevision']) < 1
    )
      throw new PublicCommentInputError(
        'A positive expected revision is required'
      );
    return this.commands.update(
      publicCommentId(id),
      {
        content: input['content'],
        expectedRevision: Number(input['expectedRevision']),
      },
      actor,
      key,
      this.target(targetId)
    );
  }

  remove(
    targetId: string,
    id: string,
    body: unknown,
    actor: DiscussionActor,
    key: string
  ) {
    const input = commentObject(body, ['expectedRevision']);
    if (
      !Number.isSafeInteger(input['expectedRevision']) ||
      Number(input['expectedRevision']) < 1
    )
      throw new PublicCommentInputError(
        'A positive expected revision is required'
      );
    return this.commands.remove(
      publicCommentId(id),
      Number(input['expectedRevision']),
      actor,
      key,
      this.target(targetId)
    );
  }

  private target(id: string): DiscussionTarget {
    return { kind: this.presentation.kind, id: publicCommentId(id) };
  }
}
