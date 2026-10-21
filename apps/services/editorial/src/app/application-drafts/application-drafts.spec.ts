import {
  ApplicationDrafts,
  type ApplicationDraftStore,
} from './application-drafts';
import { err, ok } from '@sdk/kernel/standard';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { ApplicationDraftUnavailableError } from '@domains/catalog/record';

const id = '019a0010-0000-7000-8000-000000000001';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
const fields = {
  name: 'Example',
  slug: 'example',
  website: 'https://example.test',
  description: 'An application with enough detail.',
};
describe('application draft authorization and command binding', () => {
  const store: jest.Mocked<ApplicationDraftStore> = {
    list: jest.fn(),
    read: jest.fn(),
    editingSource: jest.fn(),
    commit: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());
  it('authorizes image selection before persistence and fingerprints the exact revision, purpose and image', async () => {
    const policy = { evaluate: jest.fn(async () => ok(false)) };
    const service = new ApplicationDrafts(store, policy, {
      generate: () => id,
    });
    const input = { expectedRevision: 2, purpose: 'logo', imageId: id };
    await expect(
      service.changeImages(actor, id, input, 'key')
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(store.commit).not.toHaveBeenCalled();
    policy.evaluate.mockResolvedValue(ok(true));
    await service.changeImages(actor, id, input, 'key');
    await service.changeImages(actor, id, input, 'key');
    const first = store.commit.mock.calls[0][0];
    expect(first).toMatchObject({
      actor,
      id,
      type: 'images',
      expectedRevision: 2,
      imageChange: input,
    });
    expect(store.commit.mock.calls[1][0].fingerprint).toBe(first.fingerprint);
    for (const change of [
      { imageId: null },
      { purpose: 'banner' },
      { expectedRevision: 3 },
    ]) {
      await service.changeImages(actor, id, { ...input, ...change }, 'key');
      expect(
        store.commit.mock.calls[store.commit.mock.calls.length - 1][0]
          .fingerprint
      ).not.toBe(first.fingerprint);
    }
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.application-draft.update',
      })
    );
  });
  it('denies canonical source reads and editing commands before storage access', async () => {
    const service = new ApplicationDrafts(
      store,
      { evaluate: async () => ok(false) },
      { generate: () => id }
    );
    await expect(service.source(actor, id)).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    for (const action of ['open', 'rebase'] as const)
      await expect(
        service.editExisting(actor, action, id, {}, 'key')
      ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(store.editingSource).not.toHaveBeenCalled();
    expect(store.commit).not.toHaveBeenCalled();
  });
  it('binds canonical revision, grant and explicit merged content into editing retries', async () => {
    const service = new ApplicationDrafts(
      store,
      { evaluate: async () => ok(true) },
      { generate: () => id }
    );
    const editing = {
      applicationId: '019a0010-0000-7000-8000-000000000002',
      claimId: '019a0010-0000-7000-8000-000000000003',
      sourcePublicationRevision: 3,
    };
    await service.editExisting(
      actor,
      'open',
      null,
      { editing, fields },
      'open-key'
    );
    const first = store.commit.mock.calls[0][0];
    expect(first).toEqual(
      expect.objectContaining({
        type: 'open',
        editing,
        fields,
        expectedRevision: null,
      })
    );
    await service.editExisting(
      actor,
      'open',
      null,
      { editing, fields },
      'open-key'
    );
    expect(store.commit.mock.calls[1][0].fingerprint).toBe(first.fingerprint);
    await service.editExisting(
      actor,
      'open',
      null,
      { editing: { ...editing, sourcePublicationRevision: 4 }, fields },
      'open-key'
    );
    expect(store.commit.mock.calls[2][0].fingerprint).not.toBe(
      first.fingerprint
    );
    await service.editExisting(
      actor,
      'rebase',
      id,
      { editing, fields, expectedRevision: 2 },
      'merge-key'
    );
    expect(store.commit.mock.calls[3][0]).toEqual(
      expect.objectContaining({
        type: 'rebase',
        id,
        editing,
        expectedRevision: 2,
      })
    );
    await expect(
      service.change(actor, 'create', null, { ...fields, editing }, 'plain-key')
    ).rejects.toThrow();
  });
  it.each(['list', 'read', 'create', 'update', 'delete'] as const)(
    'denies %s before validation and persistence',
    async (action) => {
      const workspace = new ApplicationDrafts(
        store,
        { evaluate: async () => ok(false) },
        { generate: () => id }
      );
      const operation =
        action === 'list'
          ? workspace.list(actor)
          : action === 'read'
          ? workspace.read(actor, 'invalid')
          : workspace.change(actor, action, null, {}, '');
      await expect(operation).rejects.toBeInstanceOf(PermissionDeniedError);
      expect(store.list).not.toHaveBeenCalled();
      expect(store.read).not.toHaveBeenCalled();
      expect(store.commit).not.toHaveBeenCalled();
    }
  );
  it.each(['error', 'throw'] as const)(
    'fails closed on policy %s',
    async (mode) => {
      const workspace = new ApplicationDrafts(
        store,
        {
          evaluate: async () => {
            if (mode === 'throw') throw new Error('offline');
            return err(new Error('offline'));
          },
        },
        { generate: () => id }
      );
      await expect(
        workspace.change(actor, 'create', null, fields, 'key')
      ).rejects.toBeInstanceOf(ApplicationDraftUnavailableError);
      expect(store.commit).not.toHaveBeenCalled();
    }
  );
  it('binds policy to the trusted owner and tenant and normalizes immutable retry intent', async () => {
    const policy = { evaluate: jest.fn(async () => ok(true)) };
    const ids = {
      generate: jest
        .fn()
        .mockReturnValueOnce(id)
        .mockReturnValueOnce('019a0010-0000-7000-8000-000000000002'),
    };
    const workspace = new ApplicationDrafts(store, policy, ids, () => 100);
    await workspace.change(
      actor,
      'create',
      null,
      { ...fields, name: ' Example ' },
      'key'
    );
    await workspace.change(actor, 'create', null, fields, 'key');
    const [first, second] = store.commit.mock.calls.map(([command]) => command);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.id).not.toBe(second.id);
    expect(first.fields).toEqual(fields);
    expect(policy.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'editorial.application-draft.create',
        resource: {
          type: 'application-workspace',
          id: 'Alice',
          tenantId: 'default',
        },
      })
    );
    await workspace.change(
      actor,
      'update',
      id,
      { ...fields, expectedRevision: 1 },
      'update'
    );
    expect(store.commit.mock.calls[2][0]).toMatchObject({
      id,
      expectedRevision: 1,
      type: 'update',
    });
    expect(store.commit.mock.calls[2][0].fingerprint).not.toBe(
      first.fingerprint
    );
  });
  it('rejects payload ownership, public visibility, invalid revisions and extra delete fields', async () => {
    const workspace = new ApplicationDrafts(
      store,
      { evaluate: async () => ok(true) },
      { generate: () => id }
    );
    for (const extra of [
      'ownerIdentityId',
      'tenantId',
      'visibility',
      'verified',
    ])
      await expect(
        workspace.change(
          actor,
          'create',
          null,
          { ...fields, [extra]: true },
          'key'
        )
      ).rejects.toThrow();
    await expect(
      workspace.change(actor, 'update', id, fields, 'key')
    ).rejects.toThrow();
    await expect(
      workspace.change(
        actor,
        'delete',
        id,
        { expectedRevision: 1, name: 'extra' },
        'key'
      )
    ).rejects.toThrow();
    await expect(
      workspace.change(actor, 'create', null, fields, '')
    ).rejects.toThrow();
    expect(store.commit).not.toHaveBeenCalled();
  });
});
