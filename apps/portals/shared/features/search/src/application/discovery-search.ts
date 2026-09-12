import {
  DiscoverySearchResultDto,
  DiscoverySearchResultGroupDto,
  DiscoverySearchResultType,
} from '@domains/discovery';
import { APPLICATIONS, DISCOVERY_SEARCH_RESULTS_DATA, ESTIMATED_USER_SPAN_OPTIONS, MONETIZATION_OPTIONS } from '@portals/shared/data';
import { browseCatalog, CATALOG_ENTRIES, CatalogEntry, CatalogKind, CatalogQuery, normalizeCatalogFacet } from '@portals/shared/features/listing';

export const normalizeSearch = (value: string): string => value.trim().replace(/\s+/g, ' ');
const kinds: Record<DiscoverySearchResultType, CatalogKind> = {
  [DiscoverySearchResultType.Application]: 'applications',
  [DiscoverySearchResultType.Article]: 'articles',
  [DiscoverySearchResultType.Suite]: 'suites',
};

/** Reuse catalog filtering and translate its entries into the existing search card models. */
export function searchDiscoveryCatalog(params: Record<string, string>): DiscoverySearchResultDto {
  const query = { ...params, search: normalizeSearch(params['search'] ?? params['q'] ?? '') };
  const groups: DiscoverySearchResultGroupDto[] = [];
  const entries = CATALOG_ENTRIES.filter(entry => {
    if (!params['social'] && !params['estimated-users']) return true;
    const app = APPLICATIONS.find(app => entry.kind === 'applications' && app.slug === entry.slug);
    if (!app) return false;
    const socialMatches = !params['social'] || params['social'].split(',').some(value =>
      app.references.some(reference => normalizeCatalogFacet(reference.type) === normalizeCatalogFacet(value)));
    const usersMatch = !params['estimated-users'] || params['estimated-users'].split(',').some(value => {
      const range = ESTIMATED_USER_SPAN_OPTIONS.find(range => range.slug === value || String(range.id) === value);
      return !!range && app.number >= range.from && app.number < range.to;
    });
    return socialMatches && usersMatch;
  });
  for (const type of Object.values(DiscoverySearchResultType)) {
    if (params['type'] && params['type'] !== type) continue;
    const catalogQuery: CatalogQuery = {
      kind: kinds[type], search: query.search, category: params['category'] ?? '',
      tags: [params['tag'], params['tags']].filter(Boolean).join(',').split(',').filter(Boolean),
      platform: params['platform'], device: params['device'],
      monetization: expandMonetization(params['monetization']),
      sort: params['sort'] === 'newest' || params['sort'] === 'name-desc' ? params['sort'] : 'name', page: 1, pageSize: 48,
    };
    const firstPage = browseCatalog(catalogQuery, entries);
    const items = [...firstPage.items];
    for (let page = 2; page <= firstPage.totalPages; page++) {
      items.push(...browseCatalog({ ...catalogQuery, page }, entries).items);
    }
    if (items.length) groups.push({ type, entries: items.map(item => toSearchEntry(item, type)) });
  }
  return { query, groups, itemsNumber: groups.reduce((total, group) => total + group.entries.length, 0) };
}

// Filter choices describe pricing models; fixture plans may have more specific names.
function expandMonetization(selection?: string): string | undefined {
  if (!selection) return undefined;
  return selection.split(',').flatMap(value => {
    const option = MONETIZATION_OPTIONS.find(option => option.slug === value || String(option.id) === value);
    if (!option) return [value];
    const plans = APPLICATIONS.flatMap(app => app.monetizations)
      .map(plan => normalizeCatalogFacet(plan.name))
      .filter(slug => slug === option.slug || slug.startsWith(option.slug + '-') || slug.endsWith('-' + option.slug));
    return plans.length ? [...new Set(plans)] : [option.slug];
  }).join(',');
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
        applications: (item.applications ?? []).map(app => ({ ...app,
          avatarUrl: APPLICATIONS.find(record => record.slug === app.slug)?.logo ?? '' })),
        topComment: details && 'topComment' in details ? details.topComment : null };
  }
}

export function updateRecentSearches(recent: string[], phrase: string, limit = 10): string[] {
  const normalized = normalizeSearch(phrase);
  return normalized
    ? [normalized, ...recent.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, limit)
    : recent;
}
