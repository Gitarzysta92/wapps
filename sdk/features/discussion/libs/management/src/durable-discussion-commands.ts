import { createHash } from 'node:crypto';
import {
  discussionKey,
  type IDiscussionIdentificatorGenerator,
} from '@sdk/features/discussion/core';
import {
  DISCUSSION_MAX_PAYLOAD_BYTES,
  DiscussionSnapshotNode,
} from '@sdk/features/discussion/core';
import {
  IPolicyEvaluator,
  PermissionDeniedError,
} from '@sdk/kernel/ontology/authority';
import { isErr } from '@sdk/kernel/standard';
import { assertDiscussionWriteAccess } from './discussion-access';
import {
  assertDiscussionBinding,
  type DiscussionBindings,
  type DiscussionChanges,
} from './discussion-bindings.port';
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
  bindingKey?: string;
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
  input: unknown,
  bindings?: DiscussionBindings
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
      .update(
        JSON.stringify(
          canonical(bindings ? bindings.fingerprintInput(input) : input)
        )
      )
      .digest('hex'),
  };
}

export class DurableDiscussionCommands {
  constructor(
    private readonly writes: DiscussionWriteRepository,
    private readonly payloads: ImmutableDiscussionPayloads,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: IDiscussionIdentificatorGenerator,
    private readonly bindings?: DiscussionBindings
  ) {}

  async create(
    input: NewDiscussion,
    actor: DiscussionActor,
    key: string
  ): Promise<DiscussionCommit> {
    const state = input.state ?? 'published';
    const visibility = input.visibility ?? 'public';
    const bindingKey =
      input.bindingKey === undefined
        ? undefined
        : discussionKey(input.bindingKey);
    const bytes = body(
      bindingKey
        ? this.bindingContent(bindingKey, 'discussion', input.content)
        : input.content
    );
    const identity = command(
      actor,
      key,
      {
        type: 'create',
        content: JSON.parse(bytes.toString()),
        subjectId: input.subjectId ?? null,
        state,
        visibility,
        ...(bindingKey ? { bindingKey } : {}),
      },
      this.bindings
    );
    await this.authorize(actor, 'create-discussion', undefined, bindingKey, {
      state,
      visibility,
      subjectId: input.subjectId,
    });
    await assertDiscussionBinding(
      bindingKey,
      bindingKey,
      actor.tenantId,
      this.bindings
    );
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    const context = await this.prepareContext(bindingKey, bytes, actor);
    const nodeId = this.ids.generate();
    const payload = await this.payloads.put(nodeId, bytes, {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
      actorIdentityId: actor.identityId,
    });
    await assertDiscussionBinding(
      bindingKey,
      bindingKey,
      actor.tenantId,
      this.bindings
    );
    return this.writes.commit({
      type: 'create',
      context,
      ...(bindingKey ? { bindingKey } : {}),
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
    bindingKey?: string
  ): Promise<DiscussionCommit> {
    const bytes = body(
      bindingKey ? this.bindingContent(bindingKey, 'comment', content) : content
    );
    const identity = command(
      actor,
      key,
      {
        type: 'reply',
        parentId,
        content: JSON.parse(bytes.toString()),
        ...(bindingKey ? { bindingKey } : {}),
      },
      this.bindings
    );
    const resource = await this.authorizedResource(
      parentId,
      actor,
      'create-comment',
      bindingKey
    );
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    const context = await this.prepareContext(
      resource.bindingKey,
      bytes,
      actor
    );
    const nodeId = this.ids.generate();
    const payload = await this.payloads.put(nodeId, bytes, {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
      actorIdentityId: actor.identityId,
    });
    await assertDiscussionBinding(
      resource.bindingKey,
      bindingKey,
      actor.tenantId,
      this.bindings
    );
    return this.writes.commit({
      type: 'reply',
      context,
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
    bindingKey?: string
  ): Promise<DiscussionCommit> {
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.update',
      bindingKey,
      { state: input.state, visibility: input.visibility }
    );
    if (resource.ownerIdentityId === null)
      throw new PermissionDeniedError('discussion.update');
    const bytes = body(
      bindingKey
        ? this.bindingContent(bindingKey, resource.kind, input.content)
        : input.content
    );
    const identity = command(
      actor,
      key,
      {
        type: 'update',
        id,
        content: JSON.parse(bytes.toString()),
        expectedRevision: input.expectedRevision,
        state: input.state ?? null,
        visibility: input.visibility ?? null,
        ...(bindingKey ? { bindingKey } : {}),
      },
      this.bindings
    );
    const receipt = await this.writes.receipt(identity);
    if (receipt) return receipt;
    this.checkRevision(input.expectedRevision, resource.revision);
    const context = await this.prepareContext(
      resource.bindingKey,
      bytes,
      actor
    );
    const payload = await this.payloads.put(id, bytes, {
      tenantId: actor.tenantId,
      ownerIdentityId: resource.ownerIdentityId,
      actorIdentityId: actor.identityId,
    });
    await assertDiscussionBinding(
      resource.bindingKey,
      bindingKey,
      actor.tenantId,
      this.bindings
    );
    return this.writes.commit({
      type: 'update',
      context,
      command: identity,
      nodeId: id,
      resource,
      payload,
      state: input.state ?? resource.state,
      visibility: input.visibility ?? resource.visibility,
      at: Date.now(),
    });
  }

  private bindingContent(
    key: string,
    kind: 'discussion' | 'comment',
    content: unknown
  ): unknown {
    if (!this.bindings)
      throw new DiscussionNotFoundError('Discussion binding is unavailable');
    return this.bindings.content(discussionKey(key), kind, content);
  }

  private async prepareContext(
    key: string | null | undefined,
    bytes: Buffer,
    actor: DiscussionActor
  ): Promise<unknown> {
    return key && this.bindings
      ? this.bindings.context(key, JSON.parse(bytes.toString()).content, actor)
      : undefined;
  }

  async remove(
    id: string,
    expectedRevision: number,
    actor: DiscussionActor,
    key: string,
    bindingKey?: string
  ): Promise<DiscussionCommit> {
    const identity = command(
      actor,
      key,
      {
        type: 'delete',
        id,
        expectedRevision,
        ...(bindingKey ? { bindingKey } : {}),
      },
      this.bindings
    );
    // The previous receipt is needed for a retry after this command's tombstone.
    const receipt = await this.writes.receipt(identity);
    if (receipt) {
      await this.authorize(actor, 'discussion.delete', undefined, bindingKey);
      const retained = await this.writes.resource(id);
      if (!retained) throw new DiscussionNotFoundError('Discussion not found');
      await assertDiscussionBinding(
        retained.bindingKey,
        bindingKey,
        actor.tenantId,
        this.bindings
      );
      return receipt;
    }
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.delete',
      bindingKey
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
    const identity = command(actor, key, { type, id }, this.bindings);
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
    bindingKey: string
  ): Promise<DiscussionCommit> {
    const change = voteChange(input);
    const identity = command(
      actor,
      key,
      {
        type: 'vote',
        id,
        bindingKey,
        ...change,
      },
      this.bindings
    );
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.vote',
      bindingKey
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
    bindingKey: string
  ): Promise<DiscussionCommit> {
    const change = pinChange(input);
    const identity = command(
      actor,
      key,
      {
        type: 'pin',
        id,
        bindingKey,
        ...change,
      },
      this.bindings
    );
    const resource = await this.authorizedResource(
      id,
      actor,
      'discussion.pin',
      bindingKey
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
    bindingKey?: string,
    changes?: DiscussionChanges
  ) {
    const resource = await this.writes.resource(id);
    if (!resource)
      throw new DiscussionNotFoundError('Discussion content not found');
    await assertDiscussionBinding(
      resource.bindingKey,
      bindingKey,
      actor.tenantId,
      this.bindings
    );
    assertDiscussionWriteAccess(resource, actor, action);
    await this.authorize(actor, action, resource, bindingKey, changes);
    return resource;
  }

  private async authorize(
    actor: DiscussionActor,
    action: string,
    resource?: Awaited<ReturnType<DiscussionWriteRepository['resource']>>,
    bindingKey?: string,
    changes?: DiscussionChanges
  ) {
    if (bindingKey !== undefined) {
      if (!this.bindings)
        throw new DiscussionNotFoundError('Discussion binding is unavailable');
      return this.bindings.authorize(
        discussionKey(bindingKey),
        actor,
        action,
        resource ?? undefined,
        changes
      );
    }
    const result = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: actor.roles.length ? { roles: actor.roles } : undefined,
      resource: resource
        ? { type: resource.kind, id: resource.id, attributes: { ...resource } }
        : { type: 'discussion' },
    });
    if (isErr(result)) throw result.error;
    if (result.value !== true) throw new PermissionDeniedError(action);
  }
}

function changeObject(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new DiscussionValidationError('Invalid discussion change');
  const value = input as Record<string, unknown>;
  if (
    typeof value['expectedRevision'] !== 'number' ||
    !Number.isSafeInteger(value['expectedRevision']) ||
    value['expectedRevision'] < 1
  )
    throw new DiscussionValidationError(
      'A positive expected revision is required'
    );
  return value;
}
function voteChange(input: unknown): {
  value: -1 | 0 | 1;
  expectedRevision: number;
} {
  const row = changeObject(input, ['value', 'expectedRevision']);
  if (row['value'] !== -1 && row['value'] !== 0 && row['value'] !== 1)
    throw new DiscussionValidationError('Invalid discussion vote');
  return {
    value: row['value'],
    expectedRevision: Number(row['expectedRevision']),
  };
}
function pinChange(input: unknown): {
  pinned: boolean;
  expectedRevision: number;
} {
  const row = changeObject(input, ['pinned', 'expectedRevision']);
  if (typeof row['pinned'] !== 'boolean')
    throw new DiscussionValidationError('Invalid discussion pin');
  return {
    pinned: row['pinned'],
    expectedRevision: Number(row['expectedRevision']),
  };
}
