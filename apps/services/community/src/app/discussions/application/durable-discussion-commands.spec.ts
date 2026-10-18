import { err, ok } from '@sdk/kernel/standard';
import {
  IPolicyEvaluator,
  PermissionDeniedError,
} from '@sdk/kernel/ontology/authority';
import { DurableDiscussionCommands } from './durable-discussion-commands';
import {
  DiscussionActor,
  DiscussionConflictError,
  DiscussionResource,
  DiscussionWriteRepository,
  ImmutableDiscussionPayloads,
} from './discussion-write.port';

const actor: DiscussionActor = {
  identityId: 'owner',
  tenantId: 'tenant',
  roles: ['discussion:writer'],
};
export function resource(
  overrides: Partial<DiscussionResource> = {}
): DiscussionResource {
  return {
    id: 'node',
    discussionId: 'root',
    revision: 3,
    tenantId: 'tenant',
    ownerIdentityId: 'owner',
    rootOwnerIdentityId: 'owner',
    kind: 'comment',
    state: 'published',
    visibility: 'public',
    rootState: 'published',
    rootVisibility: 'public',
    deletedAt: null,
    rootDeletedAt: null,
    ...overrides,
  };
}

function fixture() {
  const writes: jest.Mocked<DiscussionWriteRepository> = {
    resource: jest.fn().mockResolvedValue(resource()),
    resources: jest.fn(),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest.fn().mockResolvedValue({
      id: 'node',
      discussionId: 'root',
      revision: 4,
      projection: 'pending',
    }),
  };
  const payloads: jest.Mocked<ImmutableDiscussionPayloads> = {
    put: jest
      .fn()
      .mockResolvedValue({ key: 'immutable', sha256: 'hash', bytes: 20 }),
  };
  const policy: jest.Mocked<IPolicyEvaluator> = {
    evaluate: jest.fn().mockResolvedValue(ok(true)),
  };
  return {
    writes,
    payloads,
    policy,
    commands: new DurableDiscussionCommands(writes, payloads, policy, {
      generate: () => 'generated-id',
    }),
  };
}

const operations = [
  [
    'create',
    (commands: DurableDiscussionCommands) =>
      commands.create({ content: 'body' }, actor, 'command'),
  ],
  [
    'reply',
    (commands: DurableDiscussionCommands) =>
      commands.reply('node', 'body', actor, 'command'),
  ],
  [
    'edit',
    (commands: DurableDiscussionCommands) =>
      commands.update(
        'node',
        { content: 'edit', expectedRevision: 3 },
        actor,
        'command'
      ),
  ],
  [
    'delete',
    (commands: DurableDiscussionCommands) =>
      commands.remove('node', 3, actor, 'command'),
  ],
  [
    'like',
    (commands: DurableDiscussionCommands) =>
      commands.like('node', true, actor, 'command'),
  ],
  [
    'unlike',
    (commands: DurableDiscussionCommands) =>
      commands.like('node', false, actor, 'command'),
  ],
] as const;

describe('durable discussion mutation boundary', () => {
  it.each(['owner ', ' owner', ''])(
    'rejects ambiguous or empty actor identity %j before persistence',
    async (identityId) => {
      const { commands, payloads, writes } = fixture();
      await expect(
        commands.create({ content: 'body' }, { ...actor, identityId }, 'key')
      ).rejects.toBeInstanceOf(PermissionDeniedError);
      expect(payloads.put).not.toHaveBeenCalled();
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );
  describe.each(operations)('%s', (_name, execute) => {
    it.each([ok(false), err(new Error('Policy unavailable'))])(
      'performs no mutations on denial or policy failure: %j',
      async (decision) => {
        const { commands, policy, payloads, writes } = fixture();
        policy.evaluate.mockResolvedValue(decision);
        await expect(execute(commands)).rejects.toBeInstanceOf(Error);
        expect(payloads.put).not.toHaveBeenCalled();
        expect(writes.commit).not.toHaveBeenCalled();
      }
    );
    it('returns the durable receipt and uses a fixed policy action', async () => {
      const { commands, policy, writes } = fixture();
      expect(await execute(commands)).toMatchObject({
        revision: 4,
        projection: 'pending',
      });
      expect(writes.commit).toHaveBeenCalledTimes(1);
      expect(policy.evaluate.mock.calls[0][0].action).toBe(
        policy.evaluate.mock.calls[0][0].actionName
      );
    });
  });

  it.each([
    { ownerIdentityId: 'other' },
    { tenantId: 'other-tenant' },
    { rootVisibility: 'private' as const, rootOwnerIdentityId: 'other' },
    { deletedAt: 10 },
    { rootDeletedAt: 10 },
  ])(
    'refuses edits outside the current owner/tenant/lifecycle: %j',
    async (overrides) => {
      const { writes, commands, payloads } = fixture();
      writes.resource.mockResolvedValue(resource(overrides));
      await expect(
        commands.update(
          'node',
          { content: 'body', expectedRevision: 3 },
          actor,
          'key'
        )
      ).rejects.toBeInstanceOf(PermissionDeniedError);
      expect(payloads.put).not.toHaveBeenCalled();
      expect(writes.commit).not.toHaveBeenCalled();
    }
  );

  it('rejects stale edits before uploading a new object', async () => {
    const { commands, payloads } = fixture();
    await expect(
      commands.update(
        'node',
        { content: 'body', expectedRevision: 2 },
        actor,
        'key'
      )
    ).rejects.toBeInstanceOf(DiscussionConflictError);
    expect(payloads.put).not.toHaveBeenCalled();
  });

  it('does not commit a payload that failed to upload', async () => {
    const { commands, writes, payloads } = fixture();
    payloads.put.mockRejectedValue(new Error('Object store unavailable'));
    await expect(
      commands.create({ content: 'body' }, actor, 'key')
    ).rejects.toThrow('Object store');
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('passes canonical owner, current tenant and authenticated actor to payload registration', async () => {
    const f = fixture();
    await f.commands.create({ content: 'body' }, actor, 'create');
    await f.commands.reply('node', 'reply', actor, 'reply');
    await f.commands.update(
      'node',
      { content: 'edit', expectedRevision: 3 },
      actor,
      'edit'
    );
    for (const call of f.payloads.put.mock.calls)
      expect(call[2]).toEqual({
        tenantId: actor.tenantId,
        ownerIdentityId: actor.identityId,
        actorIdentityId: actor.identityId,
      });
  });

  it('reports a failed SQL commit instead of acknowledging an uploaded but unreferenced object', async () => {
    const { commands, writes, payloads } = fixture();
    writes.commit.mockRejectedValue(new Error('SQL rollback'));
    await expect(
      commands.create({ content: 'body' }, actor, 'key')
    ).rejects.toThrow('SQL rollback');
    expect(payloads.put).toHaveBeenCalledTimes(1);
  });

  it('replays a committed command without uploading or mutating again', async () => {
    const { commands, writes, payloads } = fixture();
    const receipt = {
      id: 'committed',
      discussionId: 'committed',
      revision: 1,
      projection: 'pending' as const,
    };
    writes.receipt.mockResolvedValue(receipt);
    expect(await commands.create({ content: 'body' }, actor, 'key')).toEqual(
      receipt
    );
    expect(payloads.put).not.toHaveBeenCalled();
    expect(writes.commit).not.toHaveBeenCalled();
  });

  it('fingerprints equivalent JSON identically and rejects conflicting idempotency reuse', async () => {
    const { commands, writes } = fixture();
    await commands.create({ content: { a: 1, b: 2 } }, actor, 'key');
    const first = writes.receipt.mock.calls[0][0].fingerprint;
    await commands.create({ content: { b: 2, a: 1 } }, actor, 'key');
    expect(writes.receipt.mock.calls[1][0].fingerprint).toBe(first);
    writes.receipt.mockRejectedValue(
      new DiscussionConflictError('Conflicting idempotency key')
    );
    await expect(
      commands.create({ content: 'different' }, actor, 'key')
    ).rejects.toBeInstanceOf(DiscussionConflictError);
  });
});
