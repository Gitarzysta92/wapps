import { SuiteWorkspace, type SuiteWorkspaceStore } from './suite-workspace';
import { err, ok } from '@sdk/kernel/standard';

const id = '019a0010-0000-7000-8000-000000000001';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
const fields = { title: 'Tools', description: '', applicationIds: [id] };
describe('suite use-case authorization', () => {
  const store: jest.Mocked<SuiteWorkspaceStore> = {
    list: jest.fn(),
    read: jest.fn(),
    commit: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());
  it.each(['read', 'create', 'update', 'delete'])(
    'denies %s before persistence',
    async (action) => {
      const workspace = new SuiteWorkspace(
        store,
        { evaluate: async () => ok(false) },
        { generate: () => id }
      );
      const operation =
        action === 'read'
          ? workspace.list(actor)
          : workspace.change(
              actor,
              action as 'create' | 'update' | 'delete',
              id,
              fields,
              'key'
            );
      await expect(operation).rejects.toThrow();
      expect(store.list).not.toHaveBeenCalled();
      expect(store.commit).not.toHaveBeenCalled();
      expect(store.read).not.toHaveBeenCalled();
    }
  );
  it('fails closed for unavailable policies', async () => {
    const workspace = new SuiteWorkspace(
      store,
      { evaluate: async () => err(new Error('offline')) },
      { generate: () => id }
    );
    await expect(
      workspace.change(actor, 'create', null, fields, 'key')
    ).rejects.toThrow('unavailable');
    expect(store.commit).not.toHaveBeenCalled();
  });
  it('does not allow body-supplied ownership or public visibility', async () => {
    const workspace = new SuiteWorkspace(
      store,
      { evaluate: async () => ok(true) },
      { generate: () => id }
    );
    await expect(
      workspace.change(
        actor,
        'create',
        null,
        { ...fields, ownerIdentityId: 'Bob' },
        'key'
      )
    ).rejects.toThrow();
    await expect(
      workspace.change(
        actor,
        'create',
        null,
        { ...fields, visibility: 'public' },
        'key'
      )
    ).rejects.toThrow();
    expect(store.commit).not.toHaveBeenCalled();
  });
  it('binds policy to the trusted workspace identity and fingerprints normalized intent', async () => {
    const policy = { evaluate: jest.fn(async () => ok(true)) };
    const workspace = new SuiteWorkspace(
      store,
      policy,
      { generate: () => id },
      () => 100
    );
    await workspace.change(
      actor,
      'create',
      null,
      { ...fields, title: ' Tools ' },
      'key'
    );
    const first = store.commit.mock.calls[0][0];
    await workspace.change(actor, 'create', null, fields, 'key');
    expect(store.commit.mock.calls[1][0].fingerprint).toBe(first.fingerprint);
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: { type: 'suite-workspace', id: 'Alice', tenantId: 'default' },
      })
    );
  });
});
