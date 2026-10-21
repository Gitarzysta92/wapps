import { err, ok } from '@sdk/kernel/standard';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  ArticleUnavailableError,
  type ArticleFields,
} from '@domains/publication/article';
import {
  ArticleWorkspace,
  assertArticleAccess,
  type ArticleWorkspaceStore,
} from './article-workspace';
import {
  ArticleCatalog,
  type ArticleCatalogSelection,
} from './article-catalog';
import {
  projectEditorialSnapshot,
  inspectEditorialProjection,
} from '../application/editorial-materialization';
import { parseEditorialProjectionRequest } from '../application/editorial-projection-consumer';
import { DispatchEditorialOutbox } from '../application/editorial-outbox';
import {
  ArticleReviewsController,
  ArticleCatalogController,
} from './articles.controller';

const id = '019a0010-0000-7000-8000-000000000001';
const otherId = '019a0010-0000-7000-8000-000000000002';
const actor = { identityId: 'Author', tenantId: 'default', roles: [] };
const fields: ArticleFields = {
  title: 'Real article',
  slug: 'real-article',
  excerpt: 'Actual public summary.',
  byline: 'Public byline',
  category: 'Guides',
  tags: ['offline'],
  sections: [{ heading: 'Introduction', paragraphs: ['Reviewed content.'] }],
};
function fixture() {
  const store: jest.Mocked<ArticleWorkspaceStore> = {
    list: jest.fn(),
    read: jest.fn(),
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
    service: new ArticleWorkspace(store, policy, ids, () => 100),
  };
}
describe('article authorization and durable command intent', () => {
  it.each(['create', 'update', 'delete'] as const)(
    'denies %s before persistence',
    async (type) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(ok(false));
      await expect(
        f.service.change(actor, type, id, {}, 'key')
      ).rejects.toThrow(PermissionDeniedError);
      expect(f.store.changeDraft).not.toHaveBeenCalled();
    }
  );
  it.each(['submit', 'approve', 'reject', 'withdraw'] as const)(
    'denies %s before persistence',
    async (action) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(ok(false));
      await expect(
        f.service.publish(actor, id, action, {}, 'key')
      ).rejects.toThrow(PermissionDeniedError);
      expect(f.store.changePublication).not.toHaveBeenCalled();
    }
  );
  it('fails closed for private reads, returned errors and thrown policy failures', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValue(ok(false));
    await expect(f.service.list(actor)).rejects.toThrow();
    await expect(f.service.read(actor, id)).rejects.toThrow();
    await expect(f.service.status(actor, id, true)).rejects.toThrow();
    await expect(f.service.reviews(actor, 1)).rejects.toThrow();
    for (const method of Object.values(f.store))
      expect(method).not.toHaveBeenCalled();
    const unavailable = new ArticleWorkspace(
      f.store,
      { evaluate: async () => err(new Error('offline')) },
      f.ids
    );
    await expect(unavailable.list(actor)).rejects.toThrow(
      ArticleUnavailableError
    );
    f.policy.evaluate.mockRejectedValue(new Error('offline'));
    await expect(f.service.list(actor)).rejects.toThrow(
      ArticleUnavailableError
    );
  });
  it('excludes self review including administrators and rejects tenant/owner confusion', async () => {
    const owner = {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
    };
    expect(() =>
      assertArticleAccess({ ...actor, roles: ['admin'] }, owner, true)
    ).toThrow(PermissionDeniedError);
    expect(() =>
      assertArticleAccess(
        { ...actor, identityId: 'Staff', tenantId: 'other' },
        owner,
        true
      )
    ).toThrow();
    expect(() =>
      assertArticleAccess({ ...actor, identityId: 'Other' }, owner)
    ).toThrow();
    expect(() =>
      assertArticleAccess({ ...actor, identityId: 'Staff' }, owner, true)
    ).not.toThrow();
    const f = fixture();
    await f.service.status(actor, id, true);
    expect(f.policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.article.review',
        resource: { type: 'article-review', id, tenantId: 'default' },
      })
    );
    await f.service.read(actor, id);
    expect(f.policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.article.read',
        resource: {
          type: 'article-workspace',
          id: 'Author',
          tenantId: 'default',
        },
      })
    );
  });
  it('keeps create retry intent stable across allocated IDs and includes each public field', async () => {
    const f = fixture();
    f.ids.generate.mockReturnValueOnce(id).mockReturnValue(otherId);
    await f.service.change(actor, 'create', null, fields, 'same');
    await f.service.change(
      actor,
      'create',
      null,
      { ...fields, title: ' Real article ' },
      'same'
    );
    const first = f.store.changeDraft.mock.calls[0][0],
      retry = f.store.changeDraft.mock.calls[1][0];
    expect(first.id).not.toEqual(retry.id);
    expect(first.fingerprint).toEqual(retry.fingerprint);
    await f.service.change(
      actor,
      'create',
      null,
      { ...fields, byline: 'Different author' },
      'same'
    );
    expect(f.store.changeDraft.mock.calls[2][0].fingerprint).not.toEqual(
      first.fingerprint
    );
  });
  it('refuses forged authority, invalid keys and unbounded review queries', async () => {
    const f = fixture();
    await expect(
      f.service.change(
        actor,
        'create',
        null,
        { ...fields, ownerIdentityId: 'Other' },
        'key'
      )
    ).rejects.toThrow();
    await expect(
      f.service.change(actor, 'create', null, fields, '')
    ).rejects.toThrow();
    await expect(
      f.service.change(actor, 'update', id, fields, 'key')
    ).rejects.toThrow();
    await expect(f.service.reviews(actor, 10001)).rejects.toThrow();
    expect(f.store.changeDraft).not.toHaveBeenCalled();
    expect(f.store.reviews).not.toHaveBeenCalled();
  });
});
describe('article public authority and materialization', () => {
  const selection: ArticleCatalogSelection = {
    tenantId: 'default',
    total: 1,
    items: [
      {
        id,
        slug: fields.slug,
        revision: 1,
        submittedRevision: 2,
        publishedAt: 100,
        updatedAt: 100,
      },
    ],
  };
  const snapshot = {
    kind: 'article' as const,
    resourceId: id,
    tenantId: 'default',
    revision: 1,
    deletedAt: null,
    content: {
      ...fields,
      submittedRevision: 2,
      publishedAt: 100,
      updatedAt: 100,
    },
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
      service: new ArticleCatalog(authority, projections),
    };
  }
  it('reads profile articles using canonical ownership and rechecks after projection I/O', async () => {
    const f = catalog();
    expect(await f.service.profile('OwnerUid', null)).toEqual({
      sharing: 'visible',
      items: [
        {
          id,
          slug: fields.slug,
          title: fields.title,
          excerpt: fields.excerpt,
          publishedAt: 100,
        },
      ],
      after: null,
    });
    expect(f.authority.select).toHaveBeenCalledTimes(2);
    expect(f.authority.select).toHaveBeenLastCalledWith({
      ownerIdentityId: 'OwnerUid',
      after: null,
    });
    f.authority.select
      .mockResolvedValueOnce(selection)
      .mockResolvedValueOnce({ ...selection, total: 0, items: [] });
    await expect(f.service.profile('OwnerUid', null)).rejects.toThrow(
      'changed while loading'
    );
    f.authority.select.mockResolvedValue(selection);
    f.projections.find.mockResolvedValue(null);
    await expect(f.service.profile('OwnerUid', null)).rejects.toThrow(
      ArticleUnavailableError
    );
  });
  it('returns reviewed detail, bounded previews and canonical favorite selections', async () => {
    const f = catalog();
    expect(await f.service.find(fields.slug)).toEqual({
      ...snapshot.content,
      id,
      revision: 1,
    });
    expect((await f.service.select([id])).items[0]).not.toHaveProperty(
      'sections'
    );
    const query = { q: 'Real', category: 'Guides', tag: 'offline', page: 1 };
    expect((await f.service.browse(query)).items[0]).not.toHaveProperty(
      'sections'
    );
    expect(f.authority.select).toHaveBeenLastCalledWith(query);
    expect(f.authority.select).toHaveBeenCalledTimes(6);
  });
  it('retains every tag through current authority rechecks and fails a changed selection', async () => {
    const f = catalog();
    f.projections.find.mockResolvedValue(projectEditorialSnapshot({ ...snapshot, content: { ...snapshot.content, tags: ['offline', 'web'] } }));
    const query = { q: '', category: '', tag: '', tags: ['offline', 'web'], page: 1 };
    await f.service.browse(query);
    expect(f.authority.select).toHaveBeenNthCalledWith(1, query);
    expect(f.authority.select).toHaveBeenNthCalledWith(2, query);
    f.authority.select.mockResolvedValueOnce(selection).mockResolvedValueOnce({ ...selection, total: 0, items: [] });
    await expect(f.service.browse(query)).rejects.toThrow('changed while loading');
    f.projections.find.mockResolvedValueOnce(null);
    await expect(f.service.browse(query)).rejects.toThrow(ArticleUnavailableError);
  });
  it('exposes current public eligibility directly from authority without Mongo or private fields', async () => {
    const f = catalog();
    f.projections.find.mockRejectedValue(new Error('Mongo offline'));
    expect(await f.service.visibility(id)).toEqual({
      id,
      tenantId: 'default',
      revision: 1,
    });
    expect(f.projections.find).not.toHaveBeenCalled();
    f.authority.select.mockResolvedValue({ ...selection, total: 0, items: [] });
    await expect(f.service.visibility(id)).rejects.toThrow('not found');
  });
  it.each([
    'missing',
    'stale',
    'hidden',
    'wrong-tenant',
    'wrong-slug',
    'corrupt',
  ] as const)('fails closed for %s materialization', async (condition) => {
    const f = catalog();
    const projection =
      condition === 'missing'
        ? null
        : condition === 'stale'
        ? projectEditorialSnapshot({ ...snapshot, revision: 2 })
        : condition === 'hidden'
        ? projectEditorialSnapshot({
            ...snapshot,
            deletedAt: 100,
            content: null,
          })
        : condition === 'wrong-tenant'
        ? projectEditorialSnapshot({ ...snapshot, tenantId: 'other' })
        : condition === 'wrong-slug'
        ? projectEditorialSnapshot({
            ...snapshot,
            content: { ...snapshot.content, slug: 'another-article' },
          })
        : {
            ...projectEditorialSnapshot(snapshot),
            content: { ...snapshot.content, title: 'Unreviewed title' },
          };
    f.projections.find.mockResolvedValue(projection);
    await expect(f.service.find(fields.slug)).rejects.toThrow(
      ArticleUnavailableError
    );
  });
  it('refuses withdrawal or replacement during projection reads', async () => {
    const f = catalog();
    f.authority.select
      .mockResolvedValueOnce(selection)
      .mockResolvedValueOnce({ ...selection, total: 0, items: [] });
    await expect(f.service.find(fields.slug)).rejects.toThrow(
      'changed while loading'
    );
    f.authority.select.mockResolvedValueOnce(selection).mockResolvedValueOnce({
      ...selection,
      items: [{ ...selection.items[0], revision: 2 }],
    });
    await expect(f.service.find(fields.slug)).rejects.toThrow(
      'changed while loading'
    );
  });
  it('uses authority for empty/not-found and never fabricates content when unavailable', async () => {
    const f = catalog();
    f.authority.select.mockResolvedValue({ ...selection, total: 0, items: [] });
    expect(
      await f.service.browse({ q: '', category: '', tag: '', page: 1 })
    ).toEqual({ items: [], total: 0, page: 1 });
    await expect(f.service.find(fields.slug)).rejects.toThrow('not found');
    expect(f.projections.find).not.toHaveBeenCalled();
    f.authority.select.mockRejectedValue(new Error('offline'));
    await expect(f.service.find(fields.slug)).rejects.toThrow('unavailable');
  });
  it('publishes complete deterministic snapshots and tombstones without private authority', () => {
    const projection = projectEditorialSnapshot(snapshot);
    expect(inspectEditorialProjection(projection)).toEqual(projection);
    expect(projectEditorialSnapshot(snapshot)).toEqual(projection);
    expect(
      inspectEditorialProjection(
        projectEditorialSnapshot({
          ...snapshot,
          revision: 2,
          deletedAt: 100,
          content: null,
        })
      ).content
    ).toBeNull();
    expect(() =>
      projectEditorialSnapshot({
        ...snapshot,
        content: { ...snapshot.content, ownerIdentityId: 'Private' },
      } as unknown as typeof snapshot)
    ).toThrow();
  });
  it('accepts durable article wakeups throughout the dispatch/consumer protocol', async () => {
    const publish = jest.fn().mockResolvedValue(undefined),
      delivered = jest.fn().mockResolvedValue(true);
    const dispatcher = new DispatchEditorialOutbox(
      {
        claim: jest.fn().mockResolvedValue({
          id: '1',
          attempts: 0,
          kind: 'article',
          resourceId: id,
          tenantId: 'default',
          revision: 1,
          createdAt: 100,
        }),
        delivered,
        failed: jest.fn(),
      },
      { publish },
      () => 'lease',
      () => 100
    );
    expect(await dispatcher.once()).toBe('delivered');
    expect(delivered).toHaveBeenCalled();
    expect(
      parseEditorialProjectionRequest(
        Buffer.from(JSON.stringify(publish.mock.calls[0][0]))
      )
    ).toEqual({
      kind: 'article',
      resourceId: id,
      tenantId: 'default',
      revision: 1,
    });
  });
  it('rejects injected query, decision and route fields', async () => {
    const f = fixture(),
      review = new ArticleReviewsController(f.service),
      reads = catalog();
    const http = new ArticleCatalogController(reads.service);
    expect(() => review.list(actor, { page: ['1', '2'] })).toThrow();
    expect(() =>
      review.decide(
        actor,
        id,
        { decision: 'approve', tenantId: 'other' },
        'key'
      )
    ).toThrow();
    expect(() => http.browse({ authorIdentityId: 'Private' })).toThrow();
    expect(() => http.select({ ids: [id, otherId] })).toThrow();
    await expect(reads.service.find('../escape')).rejects.toThrow();
    expect(reads.authority.select).not.toHaveBeenCalled();
  });
});
