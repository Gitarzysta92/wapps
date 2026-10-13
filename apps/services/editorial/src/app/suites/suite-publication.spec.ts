import { err, ok } from '@sdk/kernel/standard';
import {
  SuitePublication,
  assertSuitePublicationAccess,
  type SuitePublicationStore,
} from './suite-publication';
import { SuiteCatalog, type SuiteCatalogSelection } from './suite-catalog';
import { projectEditorialSnapshot } from '../application/editorial-materialization';

const id = '019a0010-0000-7000-8000-000000000001';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
describe('suite publication authorization', () => {
  const store: jest.Mocked<SuitePublicationStore> = {
    read: jest.fn(),
    reviews: jest.fn(),
    commit: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());
  it.each(['submit', 'approve', 'reject', 'withdraw'] as const)(
    'denies %s before persistence',
    async (action) => {
      const service = new SuitePublication(store, {
        evaluate: async () => ok(false),
      });
      await expect(
        service.change(
          actor,
          id,
          action,
          { expectedRevision: 2, submittedRevision: 1 },
          'key'
        )
      ).rejects.toThrow();
      expect(store.commit).not.toHaveBeenCalled();
    }
  );
  it('fails closed for review reads and policy outages', async () => {
    const denied = new SuitePublication(store, {
      evaluate: async () => ok(false),
    });
    await expect(denied.read(actor, id, true)).rejects.toThrow();
    await expect(denied.reviews(actor, 1)).rejects.toThrow();
    const offline = new SuitePublication(store, {
      evaluate: async () => err(new Error('offline')),
    });
    await expect(
      offline.change(actor, id, 'submit', { expectedRevision: 1 }, 'key')
    ).rejects.toThrow('unavailable');
    expect(store.read).not.toHaveBeenCalled();
    expect(store.reviews).not.toHaveBeenCalled();
    expect(store.commit).not.toHaveBeenCalled();
  });
  it('denies self review and cross-tenant access even for an administrator', () => {
    const owner = {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
    };
    expect(() =>
      assertSuitePublicationAccess({ ...actor, roles: ['admin'] }, owner, true)
    ).toThrow();
    expect(() =>
      assertSuitePublicationAccess(
        { ...actor, identityId: 'Bob', tenantId: 'other' },
        owner,
        true
      )
    ).toThrow();
    expect(() =>
      assertSuitePublicationAccess(
        { ...actor, identityId: 'Bob' },
        owner,
        false
      )
    ).toThrow();
  });
  it('authorizes reviewer permission separately from workspace self-access', async () => {
    const policy = { evaluate: jest.fn(async () => ok(true)) };
    const service = new SuitePublication(store, policy);
    await service.change(
      actor,
      id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      'approve'
    );
    expect(policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.suite.review',
        resource: { type: 'suite-review', id, tenantId: 'default' },
      })
    );
    await service.change(
      actor,
      id,
      'submit',
      { expectedRevision: 2 },
      'submit'
    );
    expect(policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.suite.submit',
        resource: { type: 'suite-workspace', id: 'Alice', tenantId: 'default' },
      })
    );
  });
});

describe('suite public reads and projection lag', () => {
  const selection: SuiteCatalogSelection = {
    tenantId: 'default',
    total: 1,
    items: [{ id, revision: 2, submittedRevision: 5, publishedAt: 200 }],
  };
  const projection = projectEditorialSnapshot({
    kind: 'suite',
    resourceId: id,
    tenantId: 'default',
    revision: 2,
    deletedAt: null,
    content: {
      title: 'Approved title',
      description: '',
      applicationIds: [id],
      submittedRevision: 5,
      publishedAt: 200,
    },
  });
  it('serves only the approved snapshot at the exact publication revision', async () => {
    const catalog = new SuiteCatalog(
      { select: async () => selection },
      { find: async () => projection }
    );
    expect(await catalog.find(id)).toEqual({
      id,
      revision: 2,
      ...projection.content,
    });
  });
  it('resolves canonical selections and omits withdrawn targets without reading stale documents', async () => {
    const select = jest.fn(async () => selection);
    const find = jest.fn(async () => projection);
    const catalog = new SuiteCatalog({ select }, { find });
    expect(await catalog.select([id, id])).toEqual({
      items: [{ id, revision: 2, ...projection.content }],
    });
    expect(select).toHaveBeenCalledWith({ ids: [id] });
    select.mockResolvedValue({ ...selection, total: 0, items: [] });
    find.mockClear();
    expect(await catalog.select([id])).toEqual({ items: [] });
    expect(find).not.toHaveBeenCalled();
    await expect(catalog.select(['slug'])).rejects.toThrow();
  });
  it('invalidates selected metadata when publication changes during projection I/O', async () => {
    const select = jest
      .fn()
      .mockResolvedValueOnce(selection)
      .mockResolvedValue({ ...selection, total: 0, items: [] });
    await expect(
      new SuiteCatalog({ select }, { find: async () => projection }).select([
        id,
      ])
    ).rejects.toThrow('changed');
  });
  it('returns only approved public metadata for a private owner lookup and rechecks its scope', async () => {
    const select = jest.fn(async () => selection);
    const catalog = new SuiteCatalog(
      { select },
      { find: async () => projection }
    );
    expect(await catalog.profile('OwnerUid', null)).toEqual({
      sharing: 'visible',
      items: [{ id, title: 'Approved title', description: '' }],
      after: null,
    });
    expect(select.mock.calls).toEqual([
      [{ ownerIdentityId: 'OwnerUid', after: null }],
      [{ ownerIdentityId: 'OwnerUid', after: null }],
    ]);
  });
  it('discards a profile collection changed during projection reads', async () => {
    const select = jest
      .fn()
      .mockResolvedValueOnce(selection)
      .mockResolvedValue({ ...selection, total: 0, items: [] });
    await expect(
      new SuiteCatalog({ select }, { find: async () => projection }).profile(
        'OwnerUid',
        null
      )
    ).rejects.toThrow('changed');
  });
  it('does not substitute an empty profile collection for a missing projection', async () => {
    await expect(
      new SuiteCatalog(
        { select: async () => selection },
        { find: async () => null }
      ).profile('OwnerUid', null)
    ).rejects.toThrow();
  });
  it.each([
    null,
    { ...projection, revision: 1 },
    { ...projection, content: { ...projection.content, title: 'Forged' } },
  ])(
    'fails explicitly for missing, stale or corrupt projections',
    async (document) => {
      await expect(
        new SuiteCatalog(
          { select: async () => selection },
          { find: async () => document }
        ).find(id)
      ).rejects.toThrow();
    }
  );
  it('does not read an old projection after withdrawal', async () => {
    const find = jest.fn();
    await expect(
      new SuiteCatalog(
        { select: async () => ({ ...selection, total: 0, items: [] }) },
        { find }
      ).find(id)
    ).rejects.toThrow('not found');
    expect(find).not.toHaveBeenCalled();
  });
  it('rejects withdrawal during projection I/O', async () => {
    const select = jest
      .fn()
      .mockResolvedValueOnce(selection)
      .mockResolvedValue({ ...selection, total: 0, items: [] });
    await expect(
      new SuiteCatalog({ select }, { find: async () => projection }).find(id)
    ).rejects.toThrow('changed');
  });
  it('preserves suite member order in deterministic projections', () => {
    const other = '019a0010-0000-7000-8000-000000000002';
    const input = {
      kind: 'suite',
      resourceId: id,
      tenantId: 'default',
      revision: 1,
      deletedAt: null,
      content: {
        title: 'Ordered',
        description: '',
        applicationIds: [other, id],
        submittedRevision: 1,
        publishedAt: 200,
      },
    };
    const document = projectEditorialSnapshot(input);
    expect(document.content).toEqual(input.content);
    expect(projectEditorialSnapshot(input)).toEqual(document);
  });
});
