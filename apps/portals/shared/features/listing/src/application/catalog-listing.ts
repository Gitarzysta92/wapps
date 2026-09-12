import {
  APPLICATIONS,
  PLATFORMS,
  DEVICES,
  ARTICLES,
  ARTICLES_DATA,
  SUITES_DATA,
  CATEGORIES,
  TAGS,
  DISCOVERY_SEARCH_RESULTS_DATA,
  DISCOVERY_SEARCH_PREVIEW_DATA,
} from '@portals/shared/data';
import { DiscoverySearchResultType } from '@domains/discovery';

export type CatalogKind = 'applications' | 'articles' | 'suites';
export type CatalogSort = 'name' | 'name-desc' | 'newest';
export interface CatalogFacet {
  id?: string | number;
  slug: string;
  name: string;
}
export interface CatalogEntry {
  kind: CatalogKind;
  slug: string;
  name: string;
  description: string;
  image?: string;
  categories: CatalogFacet[];
  tags: CatalogFacet[];
  platforms?: CatalogFacet[];
  devices?: CatalogFacet[];
  monetizations?: CatalogFacet[];
  date?: Date;
  rating?: number;
  author?: string;
  applications?: { name: string; slug: string }[];
}
export interface CatalogQuery {
  kind?: CatalogKind;
  search: string;
  category: string;
  tags: string[];
  platform?: string;
  device?: string;
  monetization?: string;
  sort: CatalogSort;
  page: number;
  pageSize: number;
}
export const normalizeCatalogFacet = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, '-');
const detailSlug = (value: string): string =>
  normalizeCatalogFacet(value).replace(/[^a-z0-9-]/g, '');
const facet = (name: string): CatalogFacet => ({
  name,
  slug: normalizeCatalogFacet(name),
});

function categoriesFor(id: string | number): CatalogFacet[] {
  const result: CatalogFacet[] = [];
  let category = CATEGORIES.find((item) => String(item.id) === String(id));
  const visited = new Set<number>();
  while (category && !visited.has(category.id)) {
    visited.add(category.id);
    result.push({ name: category.name, slug: category.slug });
    category = CATEGORIES.find((item) => item.id === category?.parentId);
  }
  return result;
}

const applications: CatalogEntry[] = APPLICATIONS.map((app) => ({
  kind: 'applications',
  slug: app.slug,
  name: app.name,
  description: app.description,
  image: app.logo,
  rating: app.rating,
  date: app.listingDate ? new Date(app.listingDate) : undefined,
  categories: categoriesFor(app.categoryId),
  platforms: PLATFORMS.filter((platform) =>
    app.platformIds.includes(platform.id)
  ).map((platform) => ({ ...facet(platform.name), id: platform.id })),
  devices: DEVICES.filter((device) => app.deviceIds.includes(device.id)).map(
    (device) => ({ ...facet(device.name), id: device.id })
  ),
  monetizations: app.monetizations.map((plan) => ({
    ...facet(plan.name),
    id: plan.id,
  })),
  tags: TAGS.filter((tag) =>
    app.tagIds.some((id) => String(id) === String(tag.id))
  ).map((tag) => ({ name: tag.name, slug: tag.slug })),
}));
const articles: CatalogEntry[] = ARTICLES.map((article) => ({
  kind: 'articles',
  slug: article.slug,
  name: article.title,
  description: article.excerpt.split(' Lorem ipsum')[0],
  image: article.coverImageUrl?.url,
  author: article.author,
  date: new Date(article.publishedDate),
  categories: [facet(article.category)],
  tags: (article.tags ?? []).map(facet),
}));
articles.push(
  ...ARTICLES_DATA.map((article) => ({
    kind: 'articles' as const,
    slug: detailSlug(article.title),
    name: article.title,
    description: article.excerpt,
    author: article.author,
    categories: [facet(article.category)],
    tags: [],
  }))
);
const suites = new Map<string, CatalogEntry>(
  SUITES_DATA.map((suite) => {
    const slug = detailSlug(suite.title);
    return [
      slug,
      {
        kind: 'suites',
        slug,
        name: suite.title,
        description: suite.description,
        categories: [facet(suite.category)],
        tags: [],
        applications: suite.apps.map((app) => ({
          name: app.name,
          slug:
            APPLICATIONS.find((record) => record.name === app.name)?.slug ?? '',
        })),
      },
    ];
  })
);
for (const data of [
  DISCOVERY_SEARCH_RESULTS_DATA,
  DISCOVERY_SEARCH_PREVIEW_DATA,
]) {
  for (const group of data.groups) {
    for (const entry of group.entries) {
      if (
        entry.type !== DiscoverySearchResultType.Suite ||
        !('applications' in entry)
      )
        continue;
      const members = entry.applications ?? [];
      suites.set(entry.slug, {
        kind: 'suites',
        slug: entry.slug,
        name: entry.name,
        description: members.map((app) => app.name).join(', '),
        image: entry.coverImageUrl?.url,
        author: entry.authorName,
        applications: members,
        categories: members.flatMap(
          (app) =>
            applications.find((item) => item.slug === app.slug)?.categories ??
            []
        ),
        tags: entry.tags ?? [],
      });
    }
  }
}
export const CATALOG_ENTRIES: readonly CatalogEntry[] = [
  ...applications,
  ...articles,
  ...suites.values(),
];

export function catalogFacets(
  entries: readonly CatalogEntry[],
  key: 'categories' | 'tags' | 'platforms' | 'devices' | 'monetizations'
): CatalogFacet[] {
  const values = new Map<string, CatalogFacet>();
  for (const entry of entries)
    for (const value of entry[key] ?? []) {
      values.set(normalizeCatalogFacet(value.slug), value);
    }
  return [...values.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Filter before sorting and slicing so totals and page boundaries describe the same result set. */
export function browseCatalog(query: CatalogQuery, entries = CATALOG_ENTRIES) {
  const matches = (values: CatalogFacet[], value: string) =>
    values.some(
      (item) =>
        normalizeCatalogFacet(item.slug) === normalizeCatalogFacet(value) ||
        (item.id !== undefined && String(item.id) === value)
    );
  const matchesSelection = (
    values: CatalogFacet[] | undefined,
    selection?: string
  ) =>
    !selection ||
    selection.split(',').some((value) => matches(values ?? [], value.trim()));
  const words = query.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = entries
    .filter((entry) => {
      const text = [
        entry.name,
        entry.description,
        entry.author,
        ...entry.tags.map((tag) => tag.name),
      ]
        .join(' ')
        .toLowerCase();
      return (
        (!query.kind || entry.kind === query.kind) &&
        matchesSelection(entry.categories, query.category) &&
        query.tags.every((tag) => matches(entry.tags, tag)) &&
        matchesSelection(entry.platforms, query.platform) &&
        matchesSelection(entry.devices, query.device) &&
        matchesSelection(entry.monetizations, query.monetization) &&
        words.every((word) => text.includes(word))
      );
    })
    .sort((a, b) => {
      const name = a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
      if (query.sort === 'name-desc') return -name;
      if (query.sort === 'newest')
        return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0) || name;
      return name;
    });
  const pageSize =
    Number.isSafeInteger(query.pageSize) && query.pageSize > 0
      ? Math.min(query.pageSize, 100)
      : 6;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(
    totalPages,
    Math.max(1, Number.isSafeInteger(query.page) ? query.page : 1)
  );
  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    totalPages,
    pageSize,
  };
}
