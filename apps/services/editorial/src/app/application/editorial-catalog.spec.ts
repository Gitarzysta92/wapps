import {
  CatalogUnavailableError,
  CatalogInputError,
  parseCatalogQuery,
} from '@domains/catalog/record';
import {
  appContent,
  appSnapshot,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import {
  CatalogAuthoritySnapshot,
  EditorialCatalog,
  catalogAncestry,
} from './editorial-catalog';
import { projectEditorialSnapshot } from './editorial-materialization';

const facets = {
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
};
const snapshot = (): CatalogAuthoritySnapshot => ({
  tenantId: 'default',
  records: [{ id: editorialId(), slug: 'application', revision: 1 }],
  facets,
  total: 1,
  page: 1,
  pageSize: 20,
  signature: 'version-one',
});

describe('revision-checked public catalog', () => {
  const authority = { read: jest.fn() };
  const projections = { find: jest.fn() };
  const catalog = new EditorialCatalog(authority, projections);

  beforeEach(() => {
    jest.resetAllMocks();
    authority.read.mockResolvedValue(snapshot());
    projections.find.mockResolvedValue(projectEditorialSnapshot(appSnapshot()));
  });

  it('serves application visibility from authority without a projection or exposing content', async () => {
    projections.find.mockRejectedValue(new Error('Projection offline'));
    expect(await catalog.visibility(editorialId())).toEqual({
      id: editorialId(),
      tenantId: 'default',
      revision: 1,
    });
    expect(projections.find).not.toHaveBeenCalled();
    authority.read.mockResolvedValue({ ...snapshot(), records: [] });
    expect(await catalog.visibility(editorialId())).toBeNull();
    authority.read.mockResolvedValue({
      ...snapshot(),
      records: [{ id: editorialId(), slug: 'application', revision: null }],
    });
    await expect(catalog.visibility(editorialId())).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
  });

  it('returns materialized content and rechecks current SQL visibility after Mongo I/O', async () => {
    const page = await catalog.browse(parseCatalogQuery({}));
    expect(page.items[0]).toMatchObject({
      id: editorialId(),
      revision: 1,
      name: 'Application',
      reviews: null,
      createdAt: '2026-10-11T00:00:00.123Z',
    });
    expect(authority.read).toHaveBeenCalledTimes(2);
    expect(projections.find).toHaveBeenCalledWith('app', editorialId());
    expect(authority.read.mock.invocationCallOrder[0]).toBeLessThan(
      projections.find.mock.invocationCallOrder[0]
    );
    expect(authority.read.mock.invocationCallOrder[1]).toBeGreaterThan(
      projections.find.mock.invocationCallOrder[0]
    );
  });

  it('hydrates renamed taxonomy from current authoritative labels', async () => {
    const tag = { id: editorialId(2), name: 'Current name', slug: 'current' };
    authority.read.mockResolvedValue({
      ...snapshot(),
      facets: { ...facets, tags: [tag] },
    });
    projections.find.mockResolvedValue(
      projectEditorialSnapshot(
        appSnapshot({ content: { ...appContent(), tagIds: [tag.id] } })
      )
    );
    expect((await catalog.find('application'))?.tags).toEqual([tag]);
  });

  it.each([
    null,
    { ...projectEditorialSnapshot(appSnapshot()), fingerprint: 'corrupt' },
    projectEditorialSnapshot(appSnapshot({ revision: 2 })),
    projectEditorialSnapshot(appSnapshot({ tenantId: 'private' })),
    projectEditorialSnapshot(appSnapshot({ resourceId: editorialId(2) })),
    projectEditorialSnapshot(appSnapshot({ deletedAt: 1, content: null })),
    projectEditorialSnapshot(
      appSnapshot({ content: { ...appContent(), isSuspended: true } })
    ),
    projectEditorialSnapshot(
      appSnapshot({ content: { ...appContent(), slug: 'changed' } })
    ),
    projectEditorialSnapshot(
      appSnapshot({ content: { ...appContent(), tagIds: [editorialId(2)] } })
    ),
  ])(
    'rejects unavailable, stale, corrupt or ineligible projections',
    async (projection) => {
      projections.find.mockResolvedValue(projection);
      await expect(catalog.find('application')).rejects.toBeInstanceOf(
        CatalogUnavailableError
      );
    }
  );

  it('rejects legacy data until ownership and projection backfill completes', async () => {
    authority.read.mockResolvedValue({
      ...snapshot(),
      records: [{ id: editorialId(), slug: 'application', revision: null }],
    });
    await expect(catalog.find('application')).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
    expect(projections.find).not.toHaveBeenCalled();
  });

  it('rejects edits, deletes, scope or taxonomy changes during projection reads', async () => {
    authority.read
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce({ ...snapshot(), signature: 'changed' });
    await expect(catalog.find('application')).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
  });

  it('reports authoritative absence without consulting projections', async () => {
    authority.read.mockResolvedValue({ ...snapshot(), records: [], total: 0 });
    expect(await catalog.find('application')).toBeNull();
    expect(projections.find).not.toHaveBeenCalled();
  });

  it('selects stable canonical IDs in caller order after a slug rename', async () => {
    authority.read.mockResolvedValue({
      ...snapshot(),
      records: [
        { id: editorialId(), slug: 'renamed', revision: 2 },
        { id: editorialId(2), slug: 'other', revision: 1 },
      ],
      total: 2,
      pageSize: 3,
    });
    projections.find.mockImplementation(async (_kind, id) =>
      projectEditorialSnapshot(
        appSnapshot({
          resourceId: id,
          revision: id === editorialId() ? 2 : 1,
          content: {
            ...appContent(),
            slug: id === editorialId() ? 'renamed' : 'other',
          },
        })
      )
    );
    const result = await catalog.select([
      editorialId(2),
      editorialId(3),
      editorialId(),
      editorialId(2),
    ]);
    expect(result.items.map(({ id, slug }) => ({ id, slug }))).toEqual([
      { id: editorialId(2), slug: 'other' },
      { id: editorialId(), slug: 'renamed' },
    ]);
    expect(authority.read).toHaveBeenCalledTimes(2);
    expect(authority.read).toHaveBeenNthCalledWith(
      1,
      parseCatalogQuery({ pageSize: '3' }),
      { ids: [editorialId(2), editorialId(3), editorialId()] }
    );
    expect(authority.read.mock.calls[1]).toEqual(authority.read.mock.calls[0]);
  });

  it('never reads projected metadata for IDs excluded by current authority', async () => {
    authority.read.mockResolvedValue({ ...snapshot(), records: [], total: 0 });
    expect(await catalog.select([editorialId()])).toEqual({ items: [] });
    expect(projections.find).not.toHaveBeenCalled();
  });

  it('does not convert projection lag or concurrent visibility changes into successful absence', async () => {
    projections.find.mockResolvedValue(null);
    await expect(catalog.select([editorialId()])).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
    projections.find.mockResolvedValue(projectEditorialSnapshot(appSnapshot()));
    authority.read.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce({
      ...snapshot(),
      records: [],
      total: 0,
      signature: 'private-or-deleted',
    });
    await expect(catalog.select([editorialId()])).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
  });

  it('bounds selection work before touching either store', async () => {
    for (const ids of [[], ['application'], new Array(51).fill(editorialId())])
      await expect(catalog.select(ids)).rejects.toBeInstanceOf(
        CatalogInputError
      );
    expect(authority.read).not.toHaveBeenCalled();
    expect(projections.find).not.toHaveBeenCalled();
  });

  it('bounds concurrent projection reads within a selection', async () => {
    const ids = Array.from({ length: 25 }, (_, index) =>
      editorialId(index + 1)
    );
    authority.read.mockResolvedValue({
      ...snapshot(),
      total: 25,
      pageSize: 25,
      records: ids.map((id, index) => ({
        id,
        slug: `app-${index}`,
        revision: 1,
      })),
    });
    let active = 0;
    let maximum = 0;
    projections.find.mockImplementation(async (_kind, id) => {
      maximum = Math.max(maximum, ++active);
      await Promise.resolve();
      active--;
      return projectEditorialSnapshot(
        appSnapshot({
          resourceId: id,
          content: { ...appContent(), slug: `app-${ids.indexOf(id)}` },
        })
      );
    });
    expect((await catalog.select(ids)).items.map((app) => app.id)).toEqual(ids);
    expect(maximum).toBe(10);
  });

  it('reports dependency failures as retryable and reads facets without projection availability', async () => {
    projections.find.mockRejectedValue(new Error('Mongo unavailable'));
    expect(await catalog.facets()).toEqual(facets);
    await expect(catalog.find('application')).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
    authority.read.mockRejectedValue(new Error('SQL unavailable'));
    await expect(catalog.facets()).rejects.toBeInstanceOf(
      CatalogUnavailableError
    );
  });

  it('bounds ancestor traversal and refuses fabricated roots', () => {
    const category = {
      id: editorialId(),
      slug: 'cat',
      name: 'Category',
      parentId: editorialId(),
    };
    expect(() => catalogAncestry(category.id, [category])).toThrow(
      CatalogUnavailableError
    );
    expect(() => catalogAncestry(editorialId(2), [category])).toThrow(
      CatalogUnavailableError
    );
  });
});
