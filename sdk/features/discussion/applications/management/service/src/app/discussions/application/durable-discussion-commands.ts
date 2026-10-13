import { createHash } from 'node:crypto';
import {
  discussionTarget,
  boundDiscussionContent,
  discussionVoteChange,
  discussionPinChange,
  discussionMentionProfiles,
  discussionMentionRecipients,
  type DiscussionTarget,
  type IDiscussionIdentificatorGenerator,
} from '@sdk/features/discussion/core';
import {
  DISCUSSION_MAX_PAYLOAD_BYTES,
  DiscussionSnapshotNode,
} from '@apps/shared';
import {
  IPolicyEvaluator,
  PermissionDeniedError,
} from '@sdk/kernel/ontology/authority';
import { isErr } from '@sdk/kernel/standard';
import { assertDiscussionWriteAccess } from './discussion-access';
import type { DiscussionMentionDirectory } from './discussion-mentions.port';
import {
  assertDiscussionTarget,
  type DiscussionTargets,
} from './discussion-targets.port';
import {
  DiscussionActor,
  DiscussionCommandIdentity,
  DiscussionCommit,
  DiscussionConflictError,
  DiscussionNotFoundError,
  DiscussionValidationError,
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';

export interface NewDiscussion {
  target?: DiscussionTarget;
  content: unknown;
  subjectId?: string;
  state?: DiscussionSnapshotNode['state'];
  visibility?: DiscussionSnapshotNode['visibility'];
}

export interface DiscussionEdit {
  content: unknown;
  expectedRevision: number;
  state?: DiscussionSnapshotNode['state'];
  visibility?: DiscussionSnapshotNode['visibility'];
}

/** Stable request fingerprints make retries insensitive to JSON object key order. */
function canonical(value: unknown, depth = 0): unknown {
  if (depth > 32)
    throw new DiscussionValidationError('Content nesting exceeds limit');
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value))
    return value.map((child) => canonical(child, depth + 1));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(Reflect.get(value, key), depth + 1)])
    );
  }
  throw new DiscussionValidationError('Content must be valid JSON');
}

function body(content: unknown): Buffer {
  if (
    content === null ||
    content === undefined ||
    (typeof content === 'string' && !content.trim())
  ) {
    throw new DiscussionValidationError('Discussion content is required');
  }
  const bytes = Buffer.from(JSON.stringify({ content: canonical(content) }));
  if (bytes.length > DISCUSSION_MAX_PAYLOAD_BYTES)
    throw new DiscussionValidationError('Discussion content exceeds limit');
  return bytes;
}

function command(
  actor: DiscussionActor,
  key: string,
  input: unknown
): DiscussionCommandIdentity {
  if (
    !actor.identityId ||
    actor.identityId.trim() !== actor.identityId ||
    actor.identityId.length > 128 ||
    !actor.tenantId ||
    actor.tenantId.trim() !== actor.tenantId ||
    actor.tenantId.length > 128
  ) {
    throw new PermissionDeniedError('discussion.mutate');
  }
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
    throw new DiscussionValidationError('A valid Idempotency-Key is required');
  return {
    actor,
    key,
    fingerprint: createHash('sha256')
      .update(JSON.stringify(canonical(input)))
      .digest('hex'),
  };
}

export class DurableDiscussionCommands {
  constructor(
    private readonly writes: DiscussionWriteRepository,
    private readonly payloads: ImmutableDiscussionPayloads,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: IDiscussionIdentificatorGenerator,
    private readonly targets?: DiscussionTargets,
    private readonly mentions?: DiscussionMentionDirectory
  ) {}

  async create(
    input: NewDiscussion,
    actor: DiscussionActor,
    key: string
  ): Promise<DiscussionCommit> {
    const state = input.state ?? 'published';
    const visibility = input.visibility ?? 'public';
    const target = input.target ? discussionTarget(input.target) : undefined;
    if (
      target &&
      (input.subjectId !== target.id ||
        state !== 'published' ||
        visibility !== 'public')
    )
      throw new DiscussionValidationError(
        'Bound discussions must be public and linked to their target'
      );
    const bytes = body(
      target
        ? boundDiscussionContent(target, 'discussion', input.content)
        : input.content
    );
    const identity = command(actor, key, {
      type: 'create',
      content: JSON.parse(bytes.toString()),
      subjectId: input.subjectId ?? null,
      state,
      visibility,
      ...(target ? { target } : {}),
    });
    await this.authorize(actor, 'create-discussion', undefined, target);
    await assertDiscussionTarget(target, target, actor.tenantId, this.targets);
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    const mentions = await this.resolveMentions(target, bytes, actor);
    const nodeId = this.ids.generate();
    const payload = await this.payloads.put(nodeId, bytes, {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
      actorIdentityId: actor.identityId,
    });
    await assertDiscussionTarget(target, target, actor.tenantId, this.targets);
    return this.writes.commit({
      type: 'create',
      mentions,
      ...(target ? { target } : {}),
      command: identity,
      nodeId,
      referenceKey: this.ids.generate(),
      subjectId: input.subjectId ?? null,
      state,
      visibility,
      payload,
      at: Date.now(),
    });
  }

  async reply(
    parentId: string,
    content: unknown,
    actor: DiscussionActor,
    key: string,
    target?: DiscussionTarget
  ): Promise<DiscussionCommit> {
    const bytes = body(
      target ? boundDiscussionContent(target, 'comment', content) : content
    );
    const identity = command(actor, key, {
      type: 'reply',
      parentId,
      content: JSON.parse(bytes.toString()),
      ...(target ? { target } : {}),
    });
    const resource = await this.authorizedResource(
      parentId,
      actor,
      'create-comment',
      target
    );
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    const mentions = await this.resolveMentions(resource.target, bytes, actor);
    const nodeId = this.ids.generate();
    const payload = await this.payloads.put(nodeId, bytes, {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
      actorIdentityId: actor.identityId,
    });
    await assertDiscussionTarget(
      resource.target,
      target,
      actor.tenantId,
      this.targets
    );
    return this.writes.commit({
      type: 'reply',
      mentions,
      command: identity,
      nodeId,
      referenceKey: this.ids.generate(),
      resource,
      payload,
      at: Date.now(),
    });
  }

  async update(
    id: string,
    input: DiscussionEdit,
    actor: DiscussionActor,
    key: string,
    target?: DiscussionTarget
  ): Promise<DiscussionCommit> {
    if (
      target &&
      ((input.state && input.state !== 'published') ||
        (input.visibility && input.visibility !== 'public'))
    )
      throw new DiscussionValidationError(
        'Bound discussions use public visibility'
      );
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.update',
      target
    );
    if (
      resource.ownerIdentityId === null ||
      (target && resource.ownerIdentityId !== actor.identityId)
    )
      throw new PermissionDeniedError('discussion.update');
    const bytes = body(
      target
        ? boundDiscussionContent(target, resource.kind, input.content)
        : input.content
    );
    const identity = command(actor, key, {
      type: 'update',
      id,
      content: JSON.parse(bytes.toString()),
      expectedRevision: input.expectedRevision,
      state: input.state ?? null,
      visibility: input.visibility ?? null,
      ...(target ? { target } : {}),
    });
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    this.checkRevision(input.expectedRevision, resource.revision);
    const mentions = await this.resolveMentions(resource.target, bytes, actor);
    const payload = await this.payloads.put(id, bytes, {
      tenantId: actor.tenantId,
      ownerIdentityId: resource.ownerIdentityId,
      actorIdentityId: actor.identityId,
    });
    await assertDiscussionTarget(
      resource.target,
      target,
      actor.tenantId,
      this.targets
    );
    return this.writes.commit({
      type: 'update',
      mentions,
      command: identity,
      nodeId: id,
      resource,
      payload,
      state: input.state ?? resource.state,
      visibility: input.visibility ?? resource.visibility,
      at: Date.now(),
    });
  }

  private async resolveMentions(
    target: DiscussionTarget | null | undefined,
    bytes: Buffer,
    actor: DiscussionActor
  ) {
    if (!target) return [];
    const content: unknown = JSON.parse(bytes.toString()).content;
    const profiles = discussionMentionProfiles(
      content && typeof content === 'object' && 'mentions' in content
        ? content.mentions
        : []
    );
    if (!profiles.length) return [];
    if (!this.mentions)
      throw new Error('Mention recipient authority is not configured');
    const recipients = discussionMentionRecipients(
      await this.mentions.resolve(actor.identityId, profiles),
      profiles
    );
    if (recipients.some((row) => row.identityId === actor.identityId))
      throw new Error('Mention recipient authority returned the author');
    return recipients;
  }

  async remove(
    id: string,
    expectedRevision: number,
    actor: DiscussionActor,
    key: string,
    target?: DiscussionTarget
  ): Promise<DiscussionCommit> {
    const identity = command(actor, key, {
      type: 'delete',
      id,
      expectedRevision,
      ...(target ? { target } : {}),
    });
    // The previous receipt is needed for a retry after this command's tombstone.
    const receipt = await this.writes.receipt(identity);
    if (receipt) {
      await this.authorize(actor, 'discussion.delete', undefined, target);
      const retained = await this.writes.resource(id);
      if (!retained) throw new DiscussionNotFoundError('Discussion not found');
      await assertDiscussionTarget(
        retained.target,
        target,
        actor.tenantId,
        this.targets
      );
      return receipt;
    }
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.delete',
      target
    );
    this.checkRevision(expectedRevision, resource.revision);
    return this.writes.commit({
      type: 'delete',
      command: identity,
      nodeId: id,
      resource,
      at: Date.now(),
    });
  }

  async like(
    id: string,
    liked: boolean,
    actor: DiscussionActor,
    key: string
  ): Promise<DiscussionCommit> {
    const type = liked ? 'like' : 'unlike';
    const identity = command(actor, key, { type, id });
    const resource = await this.authorizedResource(
      id,
      actor,
      `discussion.comment.${type}`
    );
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    return this.writes.commit({
      type,
      command: identity,
      nodeId: id,
      resource,
      at: Date.now(),
    });
  }

  async vote(
    id: string,
    input: unknown,
    actor: DiscussionActor,
    key: string,
    target: DiscussionTarget
  ): Promise<DiscussionCommit> {
    if (target.kind !== 'application')
      throw new DiscussionValidationError(
        'Voting requires an application topic'
      );
    const change = discussionVoteChange(input);
    const identity = command(actor, key, {
      type: 'vote',
      id,
      target,
      ...change,
    });
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.vote',
      target
    );
    if (
      resource.state !== 'published' ||
      resource.visibility !== 'public' ||
      resource.rootState !== 'published' ||
      resource.rootVisibility !== 'public'
    )
      throw new PermissionDeniedError('discussion.vote');
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    this.checkRevision(change.expectedRevision, resource.revision);
    return this.writes.commit({
      type: 'vote',
      command: identity,
      nodeId: id,
      resource,
      value: change.value,
      at: Date.now(),
    });
  }

  async pin(
    id: string,
    input: unknown,
    actor: DiscussionActor,
    key: string,
    target: DiscussionTarget
  ): Promise<DiscussionCommit> {
    if (target.kind !== 'application')
      throw new DiscussionValidationError(
        'Pinning requires an application topic'
      );
    const change = discussionPinChange(input);
    const identity = command(actor, key, {
      type: 'pin',
      id,
      target,
      ...change,
    });
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.pin',
      target
    );
    if (
      resource.state !== 'published' ||
      resource.visibility !== 'public' ||
      resource.rootState !== 'published' ||
      resource.rootVisibility !== 'public'
    )
      throw new PermissionDeniedError('discussion.pin');
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    this.checkRevision(change.expectedRevision, resource.revision);
    return this.writes.commit({
      type: 'pin',
      command: identity,
      nodeId: id,
      resource,
      pinned: change.pinned,
      at: Date.now(),
    });
  }

  private checkRevision(expected: number, current: number): void {
    if (!Number.isSafeInteger(expected) || expected < 1)
      throw new DiscussionValidationError(
        'expectedRevision must be a positive integer'
      );
    if (expected !== current)
      throw new DiscussionConflictError(
        'Discussion changed; reload before editing'
      );
  }

  private async authorizedResource(
    id: string,
    actor: DiscussionActor,
    action: string,
    target?: DiscussionTarget
  ) {
    const resource = await this.writes.resource(id);
    if (!resource)
      throw new DiscussionNotFoundError('Discussion content not found');
    await assertDiscussionTarget(
      resource.target,
      target,
      actor.tenantId,
      this.targets
    );
    assertDiscussionWriteAccess(resource, actor, action);
    await this.authorize(actor, action, resource, target);
    return resource;
  }

  private async authorize(
    actor: DiscussionActor,
    action: string,
    resource?: Awaited<ReturnType<DiscussionWriteRepository['resource']>>,
    target?: DiscussionTarget
  ) {
    const boundActions: Record<string, string> = {
      'create-discussion': 'create',
      'create-comment': 'reply',
      'discussion.update': 'update',
      'discussion.delete': 'delete',
      'discussion.vote': 'vote',
      'discussion.pin': 'pin',
    };
    const workspace =
      target?.kind === 'article' ? 'article-comment' : 'application-topic';
    if (target && !boundActions[action])
      throw new PermissionDeniedError(action);
    const requestedAction = target
      ? `discussion.${workspace}.${boundActions[action]}`
      : action;
    const result = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action: requestedAction,
      actionName: requestedAction,
      subject: actor.roles.length ? { roles: actor.roles } : undefined,
      resource: target
        ? {
            type: `${workspace}-workspace`,
            id: actor.identityId,
            tenantId: actor.tenantId,
          }
        : resource
        ? { type: resource.kind, id: resource.id, attributes: { ...resource } }
        : { type: 'discussion' },
    });
    if (isErr(result)) throw result.error;
    if (result.value !== true) throw new PermissionDeniedError(action);
  }
}
