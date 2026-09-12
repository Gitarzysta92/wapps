import {
  browseCatalog,
  CATALOG_ENTRIES,
  CatalogQuery,
} from '@portals/shared/features/listing';

const query = (patch: Partial<CatalogQuery> = {}): CatalogQuery => ({
  search: '',
  category: '',
  tags: [],
  sort: 'name',
  page: 1,
  pageSize: 6,
  ...patch,
});

describe('catalog browsing', () => {
  it.each(['applications', 'articles', 'suites'] as const)(
    'lists only %s with real slugs',
    (kind) => {
      const result = browseCatalog(query({ kind }));
      expect(result.total).toBeGreaterThan(0);
      expect(
        result.items.every((entry) => entry.kind === kind && !!entry.slug)
      ).toBe(true);
    }
  );
  it('searches shared application records instead of generated samples', () => {
    expect(
      browseCatalog(
        query({ kind: 'applications', search: 'Photo Snap' })
      ).items.map((item) => item.slug)
    ).toEqual(['photo-snap']);
  });
  it('matches parent categories and normalized tag names together', () => {
    const app = CATALOG_ENTRIES.find(
      (entry) =>
        entry.kind === 'applications' &&
        entry.categories.length > 1 &&
        entry.tags.length
    )!;
    expect(
      browseCatalog(
        query({
          kind: 'applications',
          category: app.categories[1].slug,
          tags: [app.tags[0].slug.toLowerCase().replace(/\s+/g, '-')],
        })
      ).items.some((item) => item.slug === app.slug)
    ).toBe(true);
  });
  it('does not silently ignore unknown categories or tags', () => {
    expect(browseCatalog(query({ category: 'no-such-category' })).total).toBe(
      0
    );
    expect(browseCatalog(query({ tags: ['no-such-tag'] })).total).toBe(0);
  });
  it('sorts the full set before paginating, without overlapping pages', () => {
    const first = browseCatalog(
      query({ kind: 'applications', pageSize: 3, sort: 'name-desc' })
    );
    const second = browseCatalog(
      query({ kind: 'applications', pageSize: 3, sort: 'name-desc', page: 2 })
    );
    expect(
      first.items.every(
        (item) => !second.items.some((other) => other.slug === item.slug)
      )
    ).toBe(true);
    expect(
      first.items[0].name.localeCompare(second.items[0].name)
    ).toBeGreaterThan(0);
    expect(first.total).toBe(second.total);
  });
  it('clamps invalid and out-of-range pages and handles empty results', () => {
    expect(browseCatalog(query({ page: NaN })).page).toBe(1);
    expect(browseCatalog(query({ page: -1 })).page).toBe(1);
    const last = browseCatalog(query({ page: 9999 }));
    expect(last.page).toBe(last.totalPages);
    expect(last.items.length).toBeGreaterThan(0);
    expect(
      browseCatalog(query({ search: 'no-such-record', page: 9999 })).items
    ).toEqual([]);
  });
  it('combines platform, device, and monetization filters using names or fixture IDs', () => {
    const named = browseCatalog(
      query({
        kind: 'applications',
        platform: 'web',
        device: 'mobile',
        monetization: 'freemium',
      })
    );
    expect(named.items.map((item) => item.slug)).toEqual(['photo-snap']);
    const ids = browseCatalog(
      query({
        kind: 'applications',
        platform: '0',
        device: '1',
        monetization: '1',
      })
    );
    expect(ids.items.map((item) => item.slug)).toEqual(['photo-snap']);
    expect(
      browseCatalog(query({ platform: 'nonexistent-platform' })).total
    ).toBe(0);
    expect(browseCatalog(query({ device: 'nonexistent-device' })).total).toBe(
      0
    );
    expect(
      browseCatalog(query({ monetization: 'nonexistent-plan' })).total
    ).toBe(0);
  });
  it('honors supported preference page sizes up to 100', () => {
    expect(browseCatalog(query({pageSize: 100})).pageSize).toBe(100);
    expect(browseCatalog(query({pageSize: 50})).pageSize).toBe(50);
    expect(browseCatalog(query({pageSize: 1000})).pageSize).toBe(100);
  });

});
