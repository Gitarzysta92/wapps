import {
  DiscoverySearchResultDto,
  DiscoverySearchResultGroupDto,
  DiscoverySearchResultType,
} from '@domains/discovery';
import { DISCOVERY_SEARCH_RESULTS_DATA } from '@portals/shared/data';
import { browseCatalog, CatalogEntry, CatalogKind, CatalogQuery } from '@portals/shared/features/listing';

export const normalizeSearch = (value: string): string => value.trim().replace(/\s+/g, ' ');
const kinds: Record<DiscoverySearchResultType, CatalogKind> = {
  [DiscoverySearchResultType.Application]: 'applications',
  [DiscoverySearchResultType.Article]: 'articles',
  [DiscoverySearchResultType.Suite]: 'suites',
};

/** Reuse catalog filtering and translate its entries into the existing search card models. */
export function searchDiscoveryCatalog(params: Record<string, string>): DiscoverySearchResultDto {
  const query = { ...params, search: normalizeSearch(params['search'] ?? '') };
  const groups: DiscoverySearchResultGroupDto[] = [];
  for (const type of Object.values(DiscoverySearchResultType)) {
    if (params['type'] && params['type'] !== type) continue;
    const catalogQuery: CatalogQuery = {
      kind: kinds[type], search: query.search, category: params['category'] ?? '',
      tags: (params['tag'] ?? '').split(',').filter(Boolean),
      sort: 'name', page: 1, pageSize: 48,
    };
    const firstPage = browseCatalog(catalogQuery);
    const items = [...firstPage.items];
    for (let page = 2; page <= firstPage.totalPages; page++) {
      items.push(...browseCatalog({ ...catalogQuery, page }).items);
    }
    if (items.length) groups.push({ type, entries: items.map(item => toSearchEntry(item, type)) });
  }
  return { query, groups, itemsNumber: groups.reduce((total, group) => total + group.entries.length, 0) };
}

function toSearchEntry(item: CatalogEntry, type: DiscoverySearchResultType): DiscoverySearchResultGroupDto['entries'][number] {
  const details = DISCOVERY_SEARCH_RESULTS_DATA.groups.find(group => group.type === type)?.entries.find(entry => entry.slug === item.slug);
  const common = {
    name: item.name, slug: item.slug, type,
    coverImageUrl: { url: item.image ?? '', alt: item.name }, tags: item.tags,
    commentsNumber: details?.commentsNumber ?? 0,
  };
  switch (type) {
    case DiscoverySearchResultType.Application:
      return { ...common, rating: item.rating ?? 0,
        category: item.categories[0] ?? { name: '', slug: '' },
        topReview: details && 'topReview' in details ? details.topReview : null };
    case DiscoverySearchResultType.Article:
      return { ...common, title: item.name, excerpt: item.description, authorName: item.author ?? '',
        authorAvatarUrl: details && 'authorAvatarUrl' in details ? details.authorAvatarUrl : '' };
    case DiscoverySearchResultType.Suite:
      return { ...common, numberOfApps: item.applications?.length ?? 0, authorName: item.author ?? '',
        authorAvatarUrl: details && 'authorAvatarUrl' in details ? details.authorAvatarUrl : '',
        applications: (item.applications ?? []).map(app => ({ ...app, avatarUrl: '' })),
        topComment: details && 'topComment' in details ? details.topComment : null };
  }
}

export function updateRecentSearches(recent: string[], phrase: string, limit = 10): string[] {
  const normalized = normalizeSearch(phrase);
  return normalized
    ? [normalized, ...recent.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, limit)
    : recent;
}
