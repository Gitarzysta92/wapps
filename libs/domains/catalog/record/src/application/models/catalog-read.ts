import type { ClassifiedContent } from '@domains/publication/classification';
export interface CatalogFacet {
  id: string;
  slug: string;
  name: string;
}

export interface CatalogCategory extends CatalogFacet {
  parentId: string | null;
}

export interface CatalogFacets {
  categories: CatalogCategory[];
  tags: CatalogFacet[];
  platforms: CatalogFacet[];
  devices: CatalogFacet[];
  monetizations: CatalogFacet[];
}

export interface CatalogReadQuery {
  search: string;
  categories: string[];
  tags: string[];
  platforms: string[];
  devices: string[];
  monetizations: string[];
  sort: 'name' | 'name-desc' | 'newest';
  page: number;
  pageSize: number;
}

export interface CatalogApp extends ClassifiedContent {
  id: string;
  revision: number;
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isPwa: boolean;
  estimatedNumberOfUsers: number | null;
  createdAt: string;
  updatedAt: string;
  categories: CatalogFacet[];
  tags: CatalogFacet[];
  platforms: CatalogFacet[];
  devices: CatalogFacet[];
  monetizations: CatalogFacet[];
  /** Null until an actual reviews aggregate is available. Never synthesize counts. */
  reviews: { total: number; rating: number | null } | null;
}

export interface CatalogPage {
  items: CatalogApp[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: CatalogFacets;
}

export interface CatalogSelection {
  /** Currently public records in requested ID order; absent/ineligible IDs are indistinguishable. */
  items: CatalogApp[];
}

export interface CatalogReadPort {
  browse(query: CatalogReadQuery): Promise<CatalogPage>;
  find(slug: string): Promise<CatalogApp | null>;
  select(ids: string[]): Promise<CatalogSelection>;
  facets(): Promise<CatalogFacets>;
}

export class CatalogInputError extends Error {}
export class CatalogUnavailableError extends Error {}

export const CATALOG_SELECTION_LIMIT = 50;

/** Bound before deduplication; relations use canonical UUIDs, never mutable slugs. */
export function catalogAppIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > CATALOG_SELECTION_LIMIT ||
    Array.from(value).some(
      (entry) =>
        typeof entry !== 'string' ||
        entry.length !== 36 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          entry
        )
    )
  )
    throw new CatalogInputError('Invalid catalog application IDs');
  return [...new Set<string>(value)];
}

export function parseCatalogSelectionQuery(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new CatalogInputError('Invalid catalog selection query');
  const query = Object.fromEntries(Object.entries(input));
  if (
    Object.keys(query).length !== 1 ||
    typeof query['ids'] !== 'string' ||
    query['ids'].length > CATALOG_SELECTION_LIMIT * 37 - 1
  )
    throw new CatalogInputError('Invalid catalog selection query');
  return catalogAppIds(query['ids'].split(','));
}

export function catalogSlug(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 255 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  )
    throw new CatalogInputError('Invalid catalog slug');
  return value;
}

function selection(value: unknown): string[] {
  if (value === undefined || value === '') return [];
  const values = typeof value === 'string' ? [value] : value;
  if (
    !Array.isArray(values) ||
    values.length > 20 ||
    values.some((item) => typeof item !== 'string')
  )
    throw new CatalogInputError('Invalid catalog filter');
  const entries = values
    .flatMap((item: string) => item.split(','))
    .map(catalogSlug);
  if (entries.length > 20)
    throw new CatalogInputError('Too many catalog filters');
  return [...new Set(entries)].sort();
}

function integer(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
    throw new CatalogInputError('Invalid catalog pagination');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum)
    throw new CatalogInputError('Catalog pagination exceeds limit');
  return number;
}

/** OR within ordinary facet selections, AND across facet types and every selected tag. */
export function parseCatalogQuery(input: unknown): CatalogReadQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new CatalogInputError('Invalid catalog query');
  const query = Object.fromEntries(Object.entries(input));
  const keys = [
    'search',
    'category',
    'tag',
    'tags',
    'platform',
    'device',
    'monetization',
    'sort',
    'page',
    'pageSize',
  ];
  if (Object.keys(query).some((key) => !keys.includes(key)))
    throw new CatalogInputError('Unknown catalog query field');
  const search = query['search'] ?? '';
  if (
    typeof search !== 'string' ||
    search.length > 160 ||
    [...search].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  )
    throw new CatalogInputError('Invalid catalog search');
  const normalized = search.trim().replace(/\s+/g, ' ');
  if (normalized.split(' ').length > 8)
    throw new CatalogInputError('Too many search words');
  const sort = query['sort'] ?? 'name';
  if (sort !== 'name' && sort !== 'name-desc' && sort !== 'newest')
    throw new CatalogInputError('Invalid catalog sort');
  const tags = [
    ...new Set([...selection(query['tag']), ...selection(query['tags'])]),
  ].sort();
  if (tags.length > 20) throw new CatalogInputError('Too many catalog tags');
  return {
    search: normalized,
    categories: selection(query['category']),
    tags,
    platforms: selection(query['platform']),
    devices: selection(query['device']),
    monetizations: selection(query['monetization']),
    sort,
    page: integer(query['page'], 1, 10000),
    pageSize: integer(query['pageSize'], 20, 100),
  };
}

export function catalogQueryParameters(
  query: CatalogReadQuery
): Record<string, string> {
  return {
    search: query.search,
    category: query.categories.join(','),
    tags: query.tags.join(','),
    platform: query.platforms.join(','),
    device: query.devices.join(','),
    monetization: query.monetizations.join(','),
    sort: query.sort,
    page: String(query.page),
    pageSize: String(query.pageSize),
  };
}
