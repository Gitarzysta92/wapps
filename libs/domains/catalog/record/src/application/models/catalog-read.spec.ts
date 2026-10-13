import {
  CatalogInputError,
  catalogAppIds,
  catalogQueryParameters,
  parseCatalogQuery,
  parseCatalogSelectionQuery,
} from './catalog-read';
import {
  parseCatalogApp,
  parseCatalogFacets,
  parseCatalogPage,
  parseCatalogSelection,
} from './catalog-response';

const id = '019a0010-0000-7000-8000-000000000001';
const emptyFacets = {
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
};
const app = {
  id,
  revision: 7,
  slug: 'app',
  name: 'Application',
  description: null,
  website: 'https://example.com',
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-11T00:00:00.123Z',
  updatedAt: '2026-10-11T00:00:00.123Z',
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};

describe('catalog read contract', () => {
  const secondId = '019a0010-0000-7000-8000-000000000002';

  it('bounds canonical selections before deduplication and preserves first-requested order', () => {
    expect(
      parseCatalogSelectionQuery({ ids: `${secondId},${id},${secondId}` })
    ).toEqual([secondId, id]);
    expect(catalogAppIds(new Array(50).fill(id))).toEqual([id]);
  });

  it.each([
    {},
    null,
    [],
    { ids: '' },
    { ids: id.toUpperCase() },
    { ids: 'application-slug' },
    { ids: [id] },
    { ids: { id } },
    { ids: `${id},` },
    { ids: `${id}\n` },
    { ids: `${id}, ${secondId}` },
    { ids: new Array(51).fill(id).join(',') },
    { ids: id, tenantId: 'private' },
    { ids: id, pageSize: '1' },
  ])(
    'rejects malformed or unbounded canonical selection queries: %j',
    (input) => {
      expect(() => parseCatalogSelectionQuery(input)).toThrow(
        CatalogInputError
      );
    }
  );

  it('rejects sparse and noncanonical application ID arrays at the domain boundary', () => {
    for (const input of [
      new Array(1),
      [id, undefined],
      [id + '\n'],
      new Array(51).fill(id),
    ])
      expect(() => catalogAppIds(input)).toThrow(CatalogInputError);
  });

  it('parses ordered visible subsets without inventing metadata for absent IDs', () => {
    expect(parseCatalogSelection({ items: [app] }, [secondId, id])).toEqual({
      items: [app],
    });
    expect(parseCatalogSelection({ items: [] }, [id])).toEqual({ items: [] });
    const renamed = { ...app, slug: 'renamed' };
    expect(parseCatalogSelection({ items: [renamed] }, [id])).toEqual({
      items: [renamed],
    });
  });

  it.each([
    null,
    {},
    { items: null },
    { items: [app, app] },
    { items: [{ ...app, id: secondId }] },
    { items: [{ ...app, revision: 0 }] },
  ])('rejects malformed or unrelated upstream selections: %j', (input) => {
    expect(() => parseCatalogSelection(input, [id])).toThrow();
  });

  it('rejects reordered selections and duplicate slugs', () => {
    const second = { ...app, id: secondId, slug: 'second' };
    expect(() =>
      parseCatalogSelection({ items: [second, app] }, [id, secondId])
    ).toThrow();
    expect(() =>
      parseCatalogSelection({ items: [app, { ...second, slug: app.slug }] }, [
        id,
        secondId,
      ])
    ).toThrow();
  });

  it('canonicalizes repeated facets and round-trips the transport representation', () => {
    const query = parseCatalogQuery({
      search: '  two   words ',
      category: ['tools,business', 'tools'],
      tag: 'one',
      tags: 'two,one',
      pageSize: '100',
      sort: 'newest',
    });
    expect(query).toMatchObject({
      search: 'two words',
      categories: ['business', 'tools'],
      tags: ['one', 'two'],
      page: 1,
      pageSize: 100,
    });
    expect(parseCatalogQuery(catalogQueryParameters(query))).toEqual(query);
  });

  it.each([
    { page: '1junk' },
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '10001' },
    { pageSize: '101' },
    { pageSize: ['20'] },
    { search: ['words'] },
    { search: '\n' },
    { search: 'x'.repeat(161) },
    { search: 'a b c d e f g h i' },
    { sort: 'random' },
    { category: { slug: 'tools' } },
    { tag: ['bad/slug'] },
    { tags: new Array(21).fill('tag') },
    { tenantId: 'private' },
    { isSuspended: 'false' },
  ])('rejects invalid or unauthorized query fields: %j', (value) => {
    expect(() => parseCatalogQuery(value)).toThrow(CatalogInputError);
  });

  it('keeps canonical IDs and unknown reviews without manufacturing totals', () => {
    expect(parseCatalogApp({ ...app, internal: 'secret' })).toEqual(app);
    expect(
      parseCatalogPage({
        items: [app],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        facets: emptyFacets,
      }).items[0].id
    ).toBe(id);
  });

  it.each([
    { id: 17 },
    { revision: 0 },
    { isPwa: 'false' },
    { reviews: { total: 0, rating: 0 } },
    { reviews: { total: 1, rating: 6 } },
    { website: 'javascript:alert(1)' },
    { logoUrl: 'https://user:pass@example.com/image' },
    { createdAt: '2026-10-11' },
    { tags: [{ id: 1, name: 'Tag', slug: 'tag' }] },
  ])('rejects invalid app transport values: %j', (override) => {
    expect(() => parseCatalogApp({ ...app, ...override })).toThrow();
  });

  it('rejects missing rows, misleading totals, cyclic and missing taxonomy parents', () => {
    expect(() =>
      parseCatalogPage({
        items: [],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        facets: emptyFacets,
      })
    ).toThrow();
    expect(() =>
      parseCatalogPage({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        facets: emptyFacets,
      })
    ).toThrow();
    expect(() =>
      parseCatalogFacets({
        ...emptyFacets,
        categories: [{ id, name: 'Cat', slug: 'cat', parentId: id }],
      })
    ).toThrow();
    expect(() =>
      parseCatalogFacets({
        ...emptyFacets,
        categories: [
          {
            id,
            name: 'Cat',
            slug: 'cat',
            parentId: '019a0010-0000-7000-8000-000000000002',
          },
        ],
      })
    ).toThrow();
  });
});
