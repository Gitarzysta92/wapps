import { ok } from '@sdk/kernel/standard';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { DISCUSSION_PROJECTION_SCHEMA } from '@sdk/features/discussion/core';
import {
  DurableDiscussionCommands,
  DiscussionQueries,
  DiscussionNotFoundError,
  DiscussionProjectionPendingError,
  type DiscussionActor,
  type DiscussionResource,
  type DiscussionBindings,
  type DiscussionWriteRepository,
  type ImmutableDiscussionPayloads,
  type DiscussionProjectionReader,
} from './index';

const actor: DiscussionActor = {
  identityId: 'owner',
  tenantId: 'tenant',
  roles: ['admin'],
};
const key = 'unknown-consumer|document@v987/opaque-id';
const resource: DiscussionResource = {
  id: 'root',
  discussionId: 'root',
  revision: 2,
  tenantId: 'tenant',
  ownerIdentityId: 'owner',
  rootOwnerIdentityId: 'owner',
  kind: 'discussion',
  state: 'published',
  rootState: 'published',
  visibility: 'public',
  rootVisibility: 'public',
  deletedAt: null,
  rootDeletedAt: null,
  bindingKey: key,
};

function fixture() {
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn().mockResolvedValue(resource),
    resources: jest.fn().mockResolvedValue([resource]),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest
      .fn()
      .mockResolvedValue({
        id: 'root',
        discussionId: 'root',
        revision: 3,
        projection: 'pending',
      }),
  };
  const payloads: jest.Mocked<ImmutableDiscussionPayloads> = {
    put: jest
      .fn()
      .mockResolvedValue({ key: 'immutable', sha256: 'hash', bytes: 20 }),
  };
  const bindings: jest.Mocked<DiscussionBindings> = {
    visible: jest.fn().mockResolvedValue(true),
    content: jest.fn((_key, _kind, input) => input),
    authorize: jest.fn().mockResolvedValue(undefined),
    context: jest.fn().mockResolvedValue({ audit: 'consumer-owned' }),
    anonymous: jest.fn((_key, payload) => payload),
    fingerprintInput: jest.fn((input) => input),
  };
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const commands = new DurableDiscussionCommands(
    writes,
    payloads,
    policy,
    { generate: () => 'root' },
    bindings
  );
  const head = {
    _id: 'root',
    schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
    tenantId: 'tenant',
    generation: 'g2',
    fingerprint: 'hash',
    revision: 2,
    subjectId: null,
    subjectReferenceKey: null,
    state: 'published' as const,
    visibility: 'public' as const,
    deletedAt: null,
    createdAt: 1,
    lastActivityAt: 1,
    descendantsCount: 0,
    nodeCount: 1,
    bindingKey: key,
  };
  const projections: jest.Mocked<DiscussionProjectionReader> = {
    heads: jest.fn().mockResolvedValue([head]),
    head: jest.fn().mockResolvedValue(head),
    nodes: jest
      .fn()
      .mockResolvedValue([
        {
          ...resource,
          _id: 'root',
          referenceKey: 'ref',
          generation: 'g2',
          schemaVersion: DISCUSSION_PROJECTION_SCHEMA,
          parentId: null,
          depth: 0,
          createdAt: 1,
          updatedAt: null,
          likeCount: 0,
          payload: { custom: ['content'] },
        },
      ]),
  };
  return {
    commands,
    writes,
    payloads,
    bindings,
    policy,
    head,
    projections,
    queries: new DiscussionQueries(writes, projections, 'tenant', bindings),
  };
}

describe('opaque Discussion consumer boundary', () => {
  it('creates an unfamiliar consumer key and payload without introducing domain types or versions', async () => {
    const f = fixture();
    await f.commands.create(
      {
        bindingKey: key,
        content: { arbitrary: [42, true] },
        visibility: 'private',
        state: 'draft',
      },
      actor,
      'create'
    );
    expect(f.bindings.authorize).toHaveBeenCalledWith(
      key,
      actor,
      'create-discussion',
      undefined,
      { visibility: 'private', state: 'draft', subjectId: undefined }
    );
    expect(f.writes.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        bindingKey: key,
        subjectId: null,
        context: { audit: 'consumer-owned' },
        visibility: 'private',
        state: 'draft',
      })
    );
    expect(f.payloads.put.mock.calls[0][1].toString()).toBe(
      '{"content":{"arbitrary":[42,true]}}'
    );
    expect(f.policy.evaluate).not.toHaveBeenCalled();
  });

  const changes = [
    [
      'reply',
      (f: ReturnType<typeof fixture>, binding: string | undefined) =>
        f.commands.reply('root', ['custom'], actor, 'reply', binding),
    ],
    [
      'update',
      (f: ReturnType<typeof fixture>, binding: string | undefined) =>
        f.commands.update(
          'root',
          { expectedRevision: 2, content: ['edit'] },
          actor,
          'edit',
          binding
        ),
    ],
    [
      'remove',
      (f: ReturnType<typeof fixture>, binding: string | undefined) =>
        f.commands.remove('root', 2, actor, 'remove', binding),
    ],
  ] as const;
  it.each(changes)(
    'supports %s through consumer authority',
    async (_name, change) => {
      const f = fixture();
      await expect(change(f, key)).resolves.toMatchObject({ revision: 3 });
      expect(f.writes.commit).toHaveBeenCalledTimes(1);
    }
  );
  describe.each(changes)('%s isolation', (_name, change) => {
    it.each([
      undefined,
      'unknown-consumer|document@v988/opaque-id',
      key.toUpperCase(),
    ])('rejects a missing or different key %j', async (binding) => {
      const f = fixture();
      await expect(change(f, binding)).rejects.toBeInstanceOf(
        DiscussionNotFoundError
      );
      expect(f.writes.commit).not.toHaveBeenCalled();
      expect(f.payloads.put).not.toHaveBeenCalled();
    });
    it('fails closed on consumer authority denial', async () => {
      const f = fixture();
      f.bindings.authorize.mockRejectedValue(
        new PermissionDeniedError('custom')
      );
      await expect(change(f, key)).rejects.toBeInstanceOf(
        PermissionDeniedError
      );
      expect(f.writes.commit).not.toHaveBeenCalled();
    });
  });
  it.each(['vote', 'pin'] as const)(
    'delegates %s eligibility without a known target type',
    async (operation) => {
      const f = fixture();
      await f.commands[operation](
        'root',
        operation === 'vote'
          ? { value: 1, expectedRevision: 2 }
          : { pinned: true, expectedRevision: 2 },
        actor,
        operation,
        key
      );
      expect(f.bindings.authorize).toHaveBeenCalledWith(
        key,
        actor,
        `discussion.${operation}`,
        resource,
        undefined
      );
      expect(f.writes.commit).toHaveBeenCalledTimes(1);
    }
  );
  it('rechecks current binding authority after payload storage', async () => {
    const f = fixture();
    f.bindings.visible.mockResolvedValueOnce(true).mockResolvedValue(false);
    await expect(
      f.commands.create({ bindingKey: key, content: 'x' }, actor, 'create')
    ).rejects.toBeInstanceOf(DiscussionNotFoundError);
    expect(f.payloads.put).toHaveBeenCalledTimes(1);
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('preserves exact-key fingerprints and skips side effects on historical replay', async () => {
    const f = fixture();
    const receipt = {
      id: 'root',
      discussionId: 'root',
      revision: 1,
      projection: 'pending' as const,
    };
    f.writes.receipt.mockResolvedValue(receipt);
    await expect(
      f.commands.create(
        { bindingKey: key, content: { b: 2, a: 1 } },
        actor,
        'create'
      )
    ).resolves.toEqual(receipt);
    await f.commands.create(
      { bindingKey: key, content: { a: 1, b: 2 } },
      actor,
      'create'
    );
    await f.commands.create(
      { bindingKey: key.toUpperCase(), content: { a: 1, b: 2 } },
      actor,
      'create'
    );
    const [first, second, third] = f.writes.receipt.mock.calls.map(
      ([identity]) => identity.fingerprint
    );
    expect(first).toBe(second);
    expect(first).not.toBe(third);
    expect(f.bindings.context).not.toHaveBeenCalled();
    expect(f.payloads.put).not.toHaveBeenCalled();
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
  it('does not expose bound conversations through an unbound listing', async () => {
    expect(await fixture().queries.findAll(actor)).toEqual([]);
  });
  it('reads arbitrary keyed payloads only through the exact current binding', async () => {
    const f = fixture();
    expect(
      (await f.queries.findOne('root', actor, key)).nodes[0]
    ).toMatchObject({ payload: { custom: ['content'] } });
    await expect(
      f.queries.findOne('root', actor, key + 'x')
    ).rejects.toBeInstanceOf(DiscussionNotFoundError);
    await expect(f.queries.findOne('root', actor)).rejects.toBeInstanceOf(
      DiscussionNotFoundError
    );
  });
  it('rejects a current-revision projection carrying a different consumer key', async () => {
    const f = fixture();
    f.head.bindingKey = 'other';
    await expect(f.queries.findOne('root', actor, key)).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
  });
  it('requires configured consumer authority for a bound create', async () => {
    const f = fixture();
    const commands = new DurableDiscussionCommands(
      f.writes,
      f.payloads,
      f.policy,
      { generate: () => 'root' }
    );
    await expect(
      commands.create({ bindingKey: key, content: 'x' }, actor, 'create')
    ).rejects.toBeInstanceOf(DiscussionNotFoundError);
    expect(f.writes.commit).not.toHaveBeenCalled();
  });
});
