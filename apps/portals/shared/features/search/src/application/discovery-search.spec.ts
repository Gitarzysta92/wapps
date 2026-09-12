import { DiscoverySearchResultType } from '@domains/discovery';
import { CATALOG_ENTRIES, browseCatalog } from '@portals/shared/features/listing';
import { DISCOVERY_SEARCH_RESULTS_DATA } from '@portals/shared/data';
import { searchDiscoveryCatalog, updateRecentSearches } from './discovery-search';

const search = (params: Record<string, string>) => searchDiscoveryCatalog(params);

describe('discovery search', () => {
  it('filters the entered phrase, normalizes whitespace and ignores case', () => {
    const result = search({ search: '  PHOTO   SNAP  ' });
    expect(result.query.search).toBe('PHOTO SNAP');
    expect(result.groups.flatMap(group => group.entries).map(entry => entry.name)).toContain('Photo Snap');
    expect(result.groups.flatMap(group => group.entries).map(entry => entry.name)).not.toContain('Quick Task');
    expect(search({ search: 'Quick Task' }).groups.flatMap(group => group.entries).map(entry => entry.name)).toContain('Quick Task');
  });

  it('uses the catalog query semantics and covers its complete dataset', () => {
    const result = search({ search: 'photo', type: 'application' });
    const catalog = browseCatalog({ kind: 'applications', search: 'photo', category: '', tags: [], sort: 'name', page: 1, pageSize: 48 });
    expect(result.itemsNumber).toBe(catalog.total);
    expect(search({}).itemsNumber).toBe(CATALOG_ENTRIES.length);
  });

  it('counts actual matches and excludes empty groups', () => {
    for (const phrase of ['', 'photo', 'productivity', 'nothing-matches-this-query']) {
      const result = search({ search: phrase });
      expect(result.itemsNumber).toBe(result.groups.reduce((sum, group) => sum + group.entries.length, 0));
      expect(result.groups.every(group => group.entries.length > 0)).toBe(true);
    }
    expect(search({ search: 'nothing-matches-this-query' }).groups).toEqual([]);
  });

  it('supports group links and tag/category filters without mutating fixtures', () => {
    const snapshot = JSON.stringify(DISCOVERY_SEARCH_RESULTS_DATA);
    const tagSlug = CATALOG_ENTRIES.find(entry => entry.kind === 'applications' && entry.tags.length)!.tags[0].slug;
    const result = search({ search: '', type: DiscoverySearchResultType.Application, tag: tagSlug });
    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.groups.every(group => group.type === DiscoverySearchResultType.Application)).toBe(true);
    expect(result.groups.flatMap(group => group.entries).every(entry => entry.tags.some(tag => tag.slug === tagSlug))).toBe(true);
    expect(search({ category: 'nonexistent-category' }).itemsNumber).toBe(0);
    expect(JSON.stringify(DISCOVERY_SEARCH_RESULTS_DATA)).toBe(snapshot);
  });
});

describe('recent searches', () => {
  it('moves repeated searches to the front without case duplicates', () => {
    expect(updateRecentSearches(['Photo Snap', 'Quick Task'], '  quick   TASK ')).toEqual(['quick TASK', 'Photo Snap']);
  });
  it('ignores blank searches and bounds the history', () => {
    expect(updateRecentSearches(['Photo Snap'], '   ')).toEqual(['Photo Snap']);
    expect(updateRecentSearches(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});
