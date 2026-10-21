import { err, ok } from '@sdk/kernel/standard';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { EditorialCommands } from './editorial-commands';
import { EditorialQueries } from './editorial-queries';
import {
  EditorialActor,
  EditorialConflictError,
  EditorialNotFoundError,
  EditorialResourceKind,
  EditorialResourceState,
  EditorialUnavailableError,
  EditorialValidationError,
  EditorialWrites,
} from './editorial.ports';

const id = '019a0010-0000-7000-8000-000000000001';
const actor: EditorialActor = {
  identityId: 'owner',
  tenantId: 'default',
  roles: ['editorial:publisher', 'editorial:taxonomy'],
};
const resource: EditorialResourceState = {
  id,
  kind: 'app',
  ownerIdentityId: 'owner',
  tenantId: 'default',
  revision: 3,
  deletedAt: null,
};
const kinds: EditorialResourceKind[] = ['app', 'category', 'tag'];

function setup() {
  const writes: jest.Mocked<EditorialWrites> = {
    resource: jest.fn().mockResolvedValue(resource),
    receipt: jest.fn().mockResolvedValue(null),
    commit: jest.fn().mockResolvedValue({
      id,
      kind: 'app',
      revision: 4,
      deleted: false,
      projection: 'pending',
    }),
  };
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const ids = { generate: jest.fn(() => id) };
  const commands = new EditorialCommands(writes, policy, ids, () => 100);
  return { writes, policy, ids, commands };
}

describe('Editorial application authorization and commits', () => {
  const cases = kinds.flatMap((kind) =>
    (['create', 'update', 'delete'] as const).map((type) => ({ kind, type }))
  );
  function execute(
    f: ReturnType<typeof setup>,
    kind: EditorialResourceKind,
    type: 'create' | 'update' | 'delete',
    user = actor
  ) {
    return type === 'create'
      ? f.commands.create(kind, { name: 'App', slug: 'app' }, user, 'key')
      : type === 'update'
      ? f.commands.update(
          kind,
          id,
          { name: 'Changed', expectedRevision: 3 },
          user,
          'key'
        )
      : f.commands.remove(kind, id, { expectedRevision: 3 }, user, 'key');
  }

  it.each(cases)(
    'denies $kind $type before any write or id allocation',
    async ({ kind, type }) => {
      const f = setup();
      f.writes.resource.mockResolvedValue({ ...resource, kind });
      f.policy.evaluate.mockResolvedValue(ok(false));
      await expect(execute(f, kind, type)).rejects.toBeInstanceOf(
        PermissionDeniedError
      );
      expect(f.writes.commit).not.toHaveBeenCalled();
      expect(f.ids.generate).not.toHaveBeenCalled();
    }
  );

  it.each(cases)(
    'fails closed on policy outage for $kind $type',
    async ({ kind, type }) => {
      const f = setup();
      f.writes.resource.mockResolvedValue({ ...resource, kind });
      f.policy.evaluate.mockResolvedValue(err(new Error('unavailable')));
      await expect(execute(f, kind, type)).rejects.toBeInstanceOf(
        EditorialUnavailableError
      );
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  );

  it('handles a thrown policy failure without writing', async () => {
    const f = setup();
    f.policy.evaluate.mockRejectedValue(new Error('offline'));
    await expect(execute(f, 'app', 'create')).rejects.toBeInstanceOf(
      EditorialUnavailableError
    );
    expect(f.writes.commit).not.toHaveBeenCalled();
  });

  it.each(['update', 'delete'] as const)(
    'rejects another owner for %s even when the policy allows it',
    async (type) => {
      const f = setup();
      await expect(
        execute(f, 'app', type, { ...actor, identityId: 'other' })
      ).rejects.toBeInstanceOf(PermissionDeniedError);
      expect(f.writes.commit).not.toHaveBeenCalled();
      expect(f.policy.evaluate).not.toHaveBeenCalled();
    }
  );

  it.each(['editorial:moderator', 'admin'])(
    'permits a same-tenant %s but rejects cross-tenant privilege',
    async (role) => {
      const f = setup();
      const moderator = { ...actor, identityId: 'moderator', roles: [role] };
      await execute(f, 'app', 'update', moderator);
      expect(f.writes.commit).toHaveBeenCalledTimes(1);
      f.writes.commit.mockClear();
      await expect(
        execute(f, 'app', 'update', { ...moderator, tenantId: 'other' })
      ).rejects.toBeInstanceOf(PermissionDeniedError);
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  );

  it('does not grant an administrator ownership of an unbackfilled record', async () => {
    const f = setup();
    f.writes.resource.mockResolvedValue(null);
    await expect(
      execute(f, 'app', 'update', { ...actor, roles: ['admin'] })
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(f.writes.commit).not.toHaveBeenCalled();
  });

  it('checks current authorization before replaying a receipt', async () => {
    const f = setup();
    f.writes.receipt.mockResolvedValue({
      id,
      kind: 'app',
      revision: 3,
      deleted: false,
      projection: 'pending',
    });
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(execute(f, 'app', 'create')).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    expect(f.writes.receipt).not.toHaveBeenCalled();
  });

  it('replays a committed delete without writing again', async () => {
    const f = setup();
    f.writes.resource.mockResolvedValue({
      ...resource,
      deletedAt: 99,
      revision: 4,
    });
    const receipt = {
      id,
      kind: 'app' as const,
      revision: 4,
      deleted: true,
      projection: 'pending' as const,
    };
    f.writes.receipt.mockResolvedValue(receipt);
    await expect(execute(f, 'app', 'delete')).resolves.toEqual(receipt);
    expect(f.writes.commit).not.toHaveBeenCalled();
  });

  it('rejects stale revisions and non-replayed tombstone mutations', async () => {
    const f = setup();
    f.writes.resource.mockResolvedValue({ ...resource, revision: 4 });
    await expect(execute(f, 'app', 'update')).rejects.toBeInstanceOf(
      EditorialConflictError
    );
    f.writes.resource.mockResolvedValue({ ...resource, deletedAt: 10 });
    await expect(execute(f, 'app', 'delete')).rejects.toBeInstanceOf(
      EditorialNotFoundError
    );
    expect(f.writes.commit).not.toHaveBeenCalled();
  });

  it('uses server identity, normalized input and deterministic fingerprints', async () => {
    const f = setup();
    await f.commands.create(
      'app',
      { name: ' App ', slug: 'app', isPwa: false },
      actor,
      'key'
    );
    await f.commands.create(
      'app',
      { isPwa: false, slug: 'app', name: 'App' },
      actor,
      'key'
    );
    const [a, b] = f.writes.commit.mock.calls.map(([value]) => value);
    expect(a.command.fingerprint).toBe(b.command.fingerprint);
    expect(a.command.actor).toEqual(actor);
    expect(a.id).toBe(id);
    expect(a.at).toBe(100);
    expect(f.policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.app.create',
        resource: expect.objectContaining({
          tenantId: actor.tenantId,
          attributes: expect.objectContaining({ ownerIdentityId: 'owner' }),
        }),
      })
    );
  });

  it.each([
    { name: 'App', slug: 'app', ownerIdentityId: 'someone' },
    { name: 'App', slug: 'app', tenantId: 'other' },
    { name: 'App', slug: 'app', rating: 5 },
    { name: 'App', slug: 'app', id },
    { name: 'App', slug: 'app', isSuspended: false },
    { name: 'App', slug: 'app', category: { id } },
    { name: '', slug: 'app' },
    { name: 'App', slug: '../app' },
    { name: 'App', slug: 'app', website: 'javascript:alert(1)' },
    { name: 'App', slug: 'app', website: 'https://user:secret@example.com' },
    { name: 'App', slug: 'app', isPwa: 'true' },
    { name: 'App', slug: 'app', description: 'a'.repeat(32769) },
    { name: 'App', slug: 'app', tagIds: [id, id] },
    { name: 'App', slug: 'app', tagIds: ['invalid'] },
    { name: 'App', slug: 'app', platformIds: new Array(51).fill(id) },
  ])(
    'rejects malformed or protected input without persistence %#',
    async (input) => {
      const f = setup();
      await expect(
        f.commands.create('app', input, actor, 'key')
      ).rejects.toBeInstanceOf(EditorialValidationError);
      expect(f.writes.commit).not.toHaveBeenCalled();
      expect(f.policy.evaluate).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, '', ' ', 'x'.repeat(129)])(
    'requires a bounded idempotency key %#',
    async (key) => {
      const f = setup();
      await expect(
        f.commands.create(
          'tag',
          { name: 'Tag', slug: 'tag' },
          actor,
          key as string
        )
      ).rejects.toBeInstanceOf(EditorialValidationError);
      expect(f.writes.commit).not.toHaveBeenCalled();
    }
  );

  it('scopes anonymous reads to the public tenant and returns 404 for missing resources', async () => {
    const reads = {
      list: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockResolvedValue(null),
    };
    const queries = new EditorialQueries(reads, 'public');
    await queries.list('app', null);
    expect(reads.list).toHaveBeenCalledWith('app', 'public');
    await expect(queries.find('app', id, actor)).rejects.toBeInstanceOf(
      EditorialNotFoundError
    );
    expect(reads.find).toHaveBeenCalledWith('app', id, 'default');
  });
});
