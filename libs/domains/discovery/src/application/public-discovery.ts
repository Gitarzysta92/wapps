import {
  classificationFields,
  permitsContent,
  type ClassifiedContent,
} from '@domains/publication/classification';
import { parseCatalogQuery } from '@domains/catalog/record';
import { parseArticleBrowseQuery } from '@domains/publication/article';

export const DISCOVERY_KINDS = ['application', 'article', 'suite'] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];
export type DiscoverySort = 'name' | 'name-desc' | 'newest';
export interface PublicDiscoveryQuery {
  search: string;
  kinds: DiscoveryKind[];
  sort: DiscoverySort;
  pageSize: number;
  pages: Record<DiscoveryKind, number>;
  categories: string[];
  tags: string[];
  platforms: string[];
  devices: string[];
  monetizations: string[];
}
export interface PublicDiscoveryItem extends ClassifiedContent {
  id: string;
  revision: number;
  slug: string | null;
  title: string;
  summary: string;
  at: number;
  categories: string[];
  tags: string[];
  /** Canonical names, separate from matching IDs/slugs in tags. */
  tagNames?: string[];
}
export interface PublicDiscoveryGroup {
  kind: DiscoveryKind;
  items: PublicDiscoveryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface PublicDiscoveryResult {
  groups: PublicDiscoveryGroup[];
}
export class DiscoveryInputError extends Error {}
export class DiscoveryUnavailableError extends Error {}

function object(input: unknown, keys: readonly string[]) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new DiscoveryInputError('Unsupported Discover fields or filters');
  return Object.fromEntries(Object.entries(input));
}
function number(
  input: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < min ||
    input > max
  )
    throw new DiscoveryInputError('Invalid Discover number');
  return input;
}
function queryNumber(input: unknown, fallback: number, max: number) {
  if (input === undefined) return fallback;
  if (typeof input !== 'string' || !/^[1-9][0-9]{0,4}$/.test(input))
    throw new DiscoveryInputError('Invalid Discover pagination');
  return number(Number(input), 1, max);
}
function text(
  input: unknown,
  max: number,
  empty = true,
  multiline = false
): string {
  if (
    typeof input !== 'string' ||
    input.length > max ||
    (!empty && !input.trim()) ||
    [...input].some((character) => {
      const code = character.charCodeAt(0);
      return (
        code === 127 ||
        (code < 32 && !(multiline && [9, 10, 13].includes(code)))
      );
    })
  )
    throw new DiscoveryInputError('Invalid Discover text');
  return input;
}
function values(input: unknown, maximum = 20): string[] {
  if (input === undefined || input === '') return [];
  const entries = typeof input === 'string' ? [input] : input;
  if (
    !Array.isArray(entries) ||
    entries.length > maximum ||
    entries.some((entry) => typeof entry !== 'string')
  )
    throw new DiscoveryInputError('Invalid Discover selection');
  const selected = entries
    .flatMap((entry: string) => entry.split(','))
    .map((entry) => text(entry, 255, false));
  if (selected.length > maximum)
    throw new DiscoveryInputError('Too many Discover filters');
  return [...new Set(selected)].sort();
}
function kinds(input: unknown): DiscoveryKind[] {
  if (input === undefined || input === 'all') return [...DISCOVERY_KINDS];
  const selected = values(input, 3).map((value) =>
    value.endsWith('s') ? value.slice(0, -1) : value
  );
  if (
    !selected.length ||
    selected.some((value) => !DISCOVERY_KINDS.some((kind) => kind === value))
  )
    throw new DiscoveryInputError('Choose applications, articles or suites');
  return DISCOVERY_KINDS.filter((kind) => selected.includes(kind));
}

/** Type-specific facets are explicit: suites have no canonical taxonomy. */
export function parsePublicDiscoveryQuery(
  input: unknown
): PublicDiscoveryQuery {
  const value = object(input, [
    'search',
    'q',
    'type',
    'sort',
    'page',
    'pageSize',
    'applicationPage',
    'articlePage',
    'suitePage',
    'category',
    'tag',
    'tags',
    'platform',
    'device',
    'monetization',
  ]);
  const search = text(value['search'] ?? value['q'] ?? '', 100)
    .trim()
    .replace(/\s+/g, ' ');
  if (
    value['search'] !== undefined &&
    value['q'] !== undefined &&
    search !== text(value['q'], 100).trim().replace(/\s+/g, ' ')
  )
    throw new DiscoveryInputError('Search and q must describe the same search');
  const selected = kinds(value['type']);
  const sort = value['sort'] ?? 'name';
  if (sort !== 'name' && sort !== 'name-desc' && sort !== 'newest')
    throw new DiscoveryInputError('Choose name, name-desc or newest order');
  const query: PublicDiscoveryQuery = {
    search,
    kinds: selected,
    sort,
    pageSize: queryNumber(value['pageSize'], 20, 100),
    pages: {
      application: queryNumber(
        value['applicationPage'],
        queryNumber(value['page'], 1, 10000),
        10000
      ),
      article: queryNumber(
        value['articlePage'],
        queryNumber(value['page'], 1, 10000),
        10000
      ),
      suite: queryNumber(
        value['suitePage'],
        queryNumber(value['page'], 1, 10000),
        10000
      ),
    },
    categories: values(value['category']),
    tags: values([...values(value['tag']), ...values(value['tags'])]),
    platforms: values(value['platform']),
    devices: values(value['device']),
    monetizations: values(value['monetization']),
  };
  const filtered = [
    query.categories,
    query.tags,
    query.platforms,
    query.devices,
    query.monetizations,
  ].some((items) => items.length);
  if (filtered && (selected.length !== 1 || selected[0] === 'suite'))
    throw new DiscoveryInputError(
      'Choose Applications or Articles before using their filters. Suites have no category or platform filters.'
    );
  try {
    if (selected.length === 1 && selected[0] === 'article') {
      if (
        query.categories.length > 1 ||
        query.tags.length > 1 ||
        query.platforms.length ||
        query.devices.length ||
        query.monetizations.length
      )
        throw new DiscoveryInputError(
          'Articles support one category and one tag; platform, device and pricing filters apply to Applications.'
        );
      const article = parseArticleBrowseQuery({
        q: search,
        category: query.categories[0] ?? '',
        tag: query.tags[0] ?? '',
      });
      query.categories = article.category ? [article.category] : [];
    } else {
      parseCatalogQuery({
        search,
        category: query.categories,
        tags: query.tags,
        platform: query.platforms,
        device: query.devices,
        monetization: query.monetizations,
      });
    }
  } catch (error) {
    if (error instanceof DiscoveryInputError) throw error;
    throw new DiscoveryInputError(
      'Invalid search or filters for the selected content type'
    );
  }
  return query;
}

export function publicDiscoveryParameters(
  query: PublicDiscoveryQuery
): Record<string, string> {
  return {
    search: query.search,
    type: query.kinds.join(','),
    sort: query.sort,
    pageSize: String(query.pageSize),
    applicationPage: String(query.pages.application),
    articlePage: String(query.pages.article),
    suitePage: String(query.pages.suite),
    category: query.categories.join(','),
    tags: query.tags.join(','),
    platform: query.platforms.join(','),
    device: query.devices.join(','),
    monetization: query.monetizations.join(','),
  };
}
function metadata(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 128)
    throw new DiscoveryInputError('Invalid Discover metadata');
  const result = input.map((value) => text(value, 255, false, true));
  if (new Set(result).size !== result.length)
    throw new DiscoveryInputError('Duplicate Discover metadata');
  return result;
}
function item(input: unknown, kind: DiscoveryKind): PublicDiscoveryItem {
  const value = object(input, [
    'id',
    'revision',
    'slug',
    'title',
    'summary',
    'classification',
    'at',
    'categories',
    'tags',
    'tagNames',
  ]);
  const id = text(value['id'], 36, false);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id
    )
  )
    throw new DiscoveryInputError('Invalid Discover identity');
  const slug = value['slug'];
  if (
    kind === 'suite'
      ? slug !== null
      : typeof slug !== 'string' ||
        slug.length > 255 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    throw new DiscoveryInputError('Invalid Discover destination');
  return {
    id,
    revision: number(value['revision'], 1),
    slug: slug as string | null,
    title: text(value['title'], 255, false, true),
    summary: text(value['summary'], 16000, true, true),
    at: number(value['at'], 0, 8_640_000_000_000_000),
    categories: metadata(value['categories']),
    tags: metadata(value['tags']),
    ...(value['tagNames'] === undefined
      ? {}
      : { tagNames: metadata(value['tagNames']) }),
    ...classificationFields(value['classification'], DiscoveryInputError),
  };
}
export function parsePublicDiscovery(
  input: unknown,
  query: PublicDiscoveryQuery
): PublicDiscoveryResult {
  const value = object(input, ['groups']);
  if (
    !Array.isArray(value['groups']) ||
    value['groups'].length !== query.kinds.length
  )
    throw new DiscoveryInputError('Incomplete Discover groups');
  return {
    groups: value['groups'].map((input, index) => {
      const value = object(input, [
        'kind',
        'items',
        'page',
        'pageSize',
        'total',
        'totalPages',
      ]);
      const kind = query.kinds[index];
      const total = number(value['total'], 0),
        totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.pages[kind], totalPages);
      if (
        value['kind'] !== kind ||
        value['pageSize'] !== query.pageSize ||
        value['page'] !== page ||
        value['totalPages'] !== totalPages ||
        !Array.isArray(value['items']) ||
        value['items'].length !==
          Math.min(
            query.pageSize,
            Math.max(0, total - (page - 1) * query.pageSize)
          )
      )
        throw new DiscoveryInputError('Inconsistent Discover pagination');
      const items = value['items'].map((input) => item(input, kind));
      if (new Set(items.map((item) => item.id)).size !== items.length)
        throw new DiscoveryInputError('Duplicate Discover result');
      return { kind, items, total, totalPages, page, pageSize: query.pageSize };
    }),
  };
}

/** Source totals remain unchanged; exclusions affect this bounded page only. */
export function selectPublicDiscovery(
  result: PublicDiscoveryResult,
  excludedCategories: readonly string[],
  showMatureContent = false
) {
  const excluded = new Set(
    excludedCategories.map((value) => value.toLowerCase())
  );
  return result.groups.map((group) => {
    const items = group.items.filter(
      (item) =>
        permitsContent(item, showMatureContent) &&
        !item.categories.some((category) =>
          excluded.has(category.toLowerCase())
        )
    );
    return { ...group, items, hidden: group.items.length - items.length };
  });
}
