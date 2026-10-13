import { err, ok } from '@sdk/kernel/standard';
import {
  ReleaseNotFoundError,
  type ReleaseFields,
} from '@domains/catalog/versioning';
import {
  ReleaseWorkspace,
  assertReleaseAccess,
  type ReleaseWorkspaceStore,
} from './release-workspace';
import {
  ReleaseCatalog,
  type ReleaseCatalogSelection,
} from './release-catalog';
import {
  inspectEditorialProjection,
  projectEditorialSnapshot,
} from '../application/editorial-materialization';
import {
  ReleasesController,
  ReleaseReviewsController,
  ReleaseCatalogController,
} from './releases.controller';

const id = '019a0010-0000-7000-8000-000000000001';
const applicationId = '019a0010-0000-7000-8000-000000000002';
const claimId = '019a0010-0000-7000-8000-000000000003';
const actor = { identityId: 'Owner', tenantId: 'default', roles: [] };
const at = Date.parse('2026-10-12T00:00:00.000Z');
const fields: ReleaseFields = {
  version: '1.0.0',
  channel: 'stable',
  type: 'major',
  releasedOn: '2026-10-12',
  title: 'First release',
  description: 'An initial public release.',
  changes: [{ type: 'feature', description: 'Independent approval.' }],
};
function fixture() {
  const store: jest.Mocked<ReleaseWorkspaceStore> = {
    list: jest.fn(),
    read: jest.fn(),
    source: jest.fn(),
    changeDraft: jest.fn(),
    status: jest.fn(),
    reviews: jest.fn(),
    changePublication: jest.fn(),
  };
  const policy = { evaluate: jest.fn(async () => ok(true)) };
  const ids = { generate: jest.fn(() => id) };
  return {
    store,
    policy,
    ids,
    service: new ReleaseWorkspace(store, policy, ids, () => at),
  };
}
describe('release application authorization and intent', () => {
  it.each(['create', 'open', 'update', 'rebase', 'delete'] as const)(
    'denies %s before storage',
    async (type) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(ok(false));
      await expect(
        f.service.changeDraft(actor, type, id, {}, 'key')
      ).rejects.toThrow();
      expect(f.store.changeDraft).not.toHaveBeenCalled();
    }
  );
  it.each(['submit', 'approve', 'reject', 'withdraw'] as const)(
    'denies %s before storage',
    async (action) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(ok(false));
      await expect(
        f.service.changePublication(actor, id, action, {}, 'key')
      ).rejects.toThrow();
      expect(f.store.changePublication).not.toHaveBeenCalled();
    }
  );
  it('fails closed for private reads and policy errors', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(f.service.list(actor)).rejects.toThrow();
    await expect(f.service.read(actor, id)).rejects.toThrow();
    await expect(
      f.service.source(actor, applicationId, null)
    ).rejects.toThrow();
    await expect(f.service.status(actor, id, true)).rejects.toThrow();
    await expect(f.service.reviews(actor, 1)).rejects.toThrow();
    for (const method of Object.values(f.store))
      expect(method).not.toHaveBeenCalled();
    const unavailable = new ReleaseWorkspace(
      f.store,
      { evaluate: async () => err(new Error('offline')) },
      f.ids
    );
    await expect(unavailable.list(actor)).rejects.toThrow('unavailable');
    f.policy.evaluate.mockRejectedValue(new Error('offline'));
    await expect(f.service.list(actor)).rejects.toThrow('unavailable');
  });
  it('separates reviewer permission and rejects self review and tenant confusion', async () => {
    const f = fixture();
    await f.service.status(actor, id, true);
    expect(f.policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.release.review',
        resource: { type: 'release-review', id, tenantId: actor.tenantId },
      })
    );
    await f.service.read(actor, id);
    expect(f.policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.release.read',
        resource: {
          type: 'release-workspace',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      })
    );
    const owner = {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
    };
    expect(() =>
      assertReleaseAccess({ ...actor, roles: ['admin'] }, owner, true)
    ).toThrow();
    expect(() =>
      assertReleaseAccess(
        { ...actor, identityId: 'Staff', tenantId: 'other' },
        owner,
        true
      )
    ).toThrow();
    expect(() =>
      assertReleaseAccess({ ...actor, identityId: 'Other' }, owner)
    ).toThrow();
    expect(() =>
      assertReleaseAccess({ ...actor, identityId: 'Staff' }, owner, true)
    ).not.toThrow();
  });
  it('keeps a create retry fingerprint stable despite newly generated IDs', async () => {
    const f = fixture();
    f.ids.generate
      .mockReturnValueOnce(id)
      .mockReturnValueOnce(applicationId)
      .mockReturnValue(claimId);
    await f.service.changeDraft(
      actor,
      'create',
      null,
      { applicationId, claimId, fields },
      'same'
    );
    await f.service.changeDraft(
      actor,
      'create',
      null,
      {
        applicationId,
        claimId,
        fields: { ...fields, title: ' First release ' },
      },
      'same'
    );
    const first = f.store.changeDraft.mock.calls[0][0],
      retry = f.store.changeDraft.mock.calls[1][0];
    expect(first.id).not.toBe(retry.id);
    expect(first.fingerprint).toBe(retry.fingerprint);
    expect(first.target).toEqual({
      applicationId,
      claimId,
      releaseId: applicationId,
    });
    await f.service.changeDraft(
      actor,
      'create',
      null,
      { applicationId, claimId, fields: { ...fields, version: '2' } },
      'same'
    );
    expect(f.store.changeDraft.mock.calls[2][0].fingerprint).not.toBe(
      first.fingerprint
    );
  });
  it('refuses rebinds, unbounded pages and incomplete merge commands', async () => {
    const f = fixture();
    await expect(
      f.service.changeDraft(
        actor,
        'update',
        id,
        { fields, expectedRevision: 1, claimId },
        'key'
      )
    ).rejects.toThrow();
    await expect(
      f.service.changeDraft(
        actor,
        'rebase',
        id,
        { fields, expectedRevision: 1 },
        'key'
      )
    ).rejects.toThrow();
    await expect(
      f.service.changeDraft(
        actor,
        'create',
        null,
        { fields, claimId, applicationId },
        ''
      )
    ).rejects.toThrow();
    await expect(f.service.reviews(actor, 10001)).rejects.toThrow();
    expect(f.store.changeDraft).not.toHaveBeenCalled();
  });
  it('requires an existing public revision to open a fresh private draft', async () => {
    const f = fixture();
    await f.service.changeDraft(
      actor,
      'open',
      null,
      { applicationId, claimId, releaseId: id, expectedPublicationRevision: 4 },
      'open'
    );
    expect(f.store.changeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: null,
        expectedRevision: null,
        expectedPublicationRevision: 4,
        target: { applicationId, claimId, releaseId: id },
      })
    );
    await expect(
      f.service.changeDraft(
        actor,
        'open',
        null,
        {
          applicationId,
          claimId,
          releaseId: id,
          expectedPublicationRevision: null,
        },
        'open'
      )
    ).rejects.toThrow();
  });
});

describe('release catalog and materialization boundaries', () => {
  const selection: ReleaseCatalogSelection = {
    tenantId: 'default',
    application: {
      id: applicationId,
      name: 'Application',
      slug: 'application',
      revision: 5,
    },
    total: 1,
    items: [{ id, version: fields.version, revision: 1, publishedAt: at }],
  };
  const snapshot = {
    kind: 'release' as const,
    resourceId: id,
    tenantId: 'default',
    revision: 1,
    deletedAt: null,
    content: { ...fields, applicationId, publishedAt: at },
  };
  function catalog() {
    const authority = { select: jest.fn(async () => selection) },
      projections = {
        find: jest.fn(
          async (): Promise<unknown> => projectEditorialSnapshot(snapshot)
        ),
      };
    return {
      authority,
      projections,
      service: new ReleaseCatalog(authority, projections),
    };
  }
  it('binds channel and previous-date filtering to both authority reads', async () => {
    const f = catalog();
    await f.service.browse('application', 2, {
      channel: 'stable',
      before: '2026-10-13',
    });
    expect(f.authority.select).toHaveBeenCalledTimes(2);
    expect(f.authority.select).toHaveBeenNthCalledWith(1, {
      applicationSlug: 'application',
      page: 2,
      channel: 'stable',
      before: '2026-10-13',
    });
    expect(f.authority.select).toHaveBeenNthCalledWith(2, {
      applicationSlug: 'application',
      page: 2,
      channel: 'stable',
      before: '2026-10-13',
    });
  });
  it('projects only canonical notes, adding current parent labels during the public read', async () => {
    const f = catalog();
    expect(await f.service.find('application', '1.0.0')).toEqual({
      ...fields,
      id,
      applicationId,
      applicationSlug: 'application',
      applicationName: 'Application',
      revision: 1,
      publishedAt: at,
    });
    expect(f.authority.select).toHaveBeenCalledTimes(2);
    expect(
      inspectEditorialProjection(projectEditorialSnapshot(snapshot)).content
    ).not.toHaveProperty('claimId');
  });
  it.each([
    'missing',
    'old',
    'hidden',
    'wrong-app',
    'wrong-tenant',
    'corrupt',
  ] as const)('fails closed for %s projections', async (condition) => {
    const f = catalog();
    const projection =
      condition === 'missing'
        ? null
        : condition === 'old'
        ? projectEditorialSnapshot({ ...snapshot, revision: 2 })
        : condition === 'hidden'
        ? projectEditorialSnapshot({
            ...snapshot,
            deletedAt: at,
            content: null,
          })
        : condition === 'wrong-app'
        ? projectEditorialSnapshot({
            ...snapshot,
            content: { ...snapshot.content, applicationId: claimId },
          })
        : condition === 'wrong-tenant'
        ? projectEditorialSnapshot({ ...snapshot, tenantId: 'other' })
        : {
            ...projectEditorialSnapshot(snapshot),
            content: { ...snapshot.content, title: 'Unreviewed injection' },
          };
    f.projections.find.mockResolvedValue(projection);
    await expect(f.service.browse('application', 1)).rejects.toThrow();
  });
  it('denies parent withdrawal during projection I/O and refuses mixed revisions', async () => {
    const f = catalog();
    f.authority.select
      .mockResolvedValueOnce(selection)
      .mockRejectedValueOnce(new ReleaseNotFoundError('Application not found'));
    await expect(f.service.find('application', '1.0.0')).rejects.toThrow(
      'not found'
    );
    f.authority.select.mockResolvedValueOnce(selection).mockResolvedValueOnce({
      ...selection,
      application: { ...selection.application, revision: 6 },
    });
    await expect(f.service.find('application', '1.0.0')).rejects.toThrow(
      'changed while loading'
    );
  });
  it('returns empty only from authority and never reads a hidden parent projection', async () => {
    const f = catalog();
    f.authority.select.mockResolvedValue({ ...selection, items: [], total: 0 });
    expect(await f.service.browse('application', 1)).toEqual({
      items: [],
      total: 0,
      page: 1,
    });
    await expect(f.service.find('application', '1.0.0')).rejects.toThrow(
      'not found'
    );
    f.authority.select.mockRejectedValue(
      new ReleaseNotFoundError('Application not found')
    );
    await expect(f.service.browse('application', 1)).rejects.toThrow(
      'not found'
    );
    expect(f.projections.find).not.toHaveBeenCalled();
  });
  it('validates routes before authority reads', async () => {
    const f = catalog();
    await expect(f.service.browse('application', 10001)).rejects.toThrow();
    await expect(f.service.find('../escape', '1')).rejects.toThrow();
    await expect(f.service.find('application', '../escape')).rejects.toThrow();
    expect(f.authority.select).not.toHaveBeenCalled();
  });
  it('keeps tombstone and content fingerprints deterministic and rejects private fields', () => {
    const projection = projectEditorialSnapshot(snapshot);
    expect(projectEditorialSnapshot(snapshot)).toEqual(projection);
    const tombstone = projectEditorialSnapshot({
      ...snapshot,
      revision: 2,
      deletedAt: at,
      content: null,
    });
    expect(inspectEditorialProjection(tombstone).content).toBeNull();
    expect(() =>
      projectEditorialSnapshot({
        ...snapshot,
        content: { ...snapshot.content, claimId },
      } as unknown as typeof snapshot)
    ).toThrow();
    expect(() =>
      projectEditorialSnapshot({
        ...snapshot,
        content: { ...snapshot.content, releasedOn: '2027-01-01' },
      })
    ).toThrow();
  });
});

describe('release HTTP input adapters', () => {
  it('rejects nested/duplicate query fields and protected review metadata', () => {
    const f = fixture();
    const workspace = new ReleasesController(f.service),
      reviews = new ReleaseReviewsController(f.service);
    expect(() =>
      workspace.source(actor, applicationId, { releaseId: [id, id] })
    ).toThrow();
    expect(() => reviews.list(actor, { page: ['1', '2'] })).toThrow();
    expect(() =>
      reviews.decide(
        actor,
        id,
        { decision: 'approve', tenantId: 'other' },
        'key'
      )
    ).toThrow();
    const catalog = new ReleaseCatalogController(
      new ReleaseCatalog({ select: jest.fn() }, { find: jest.fn() })
    );
    expect(() =>
      catalog.browse('application', { tenantId: 'other' })
    ).toThrow();
    expect(() =>
      catalog.find('application', '1', { preview: 'true' })
    ).toThrow();
  });
});
