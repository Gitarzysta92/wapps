import { classificationFields } from '@domains/publication/classification';
import {
  CatalogApp,
  CatalogCategory,
  CatalogFacet,
  CatalogFacets,
  CatalogPage,
  CatalogSelection,
  CatalogUnavailableError,
  catalogAppIds,
  catalogSlug,
} from './catalog-read';

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new CatalogUnavailableError('Invalid catalog response');
}

function object(value: unknown): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}

function text(value: unknown, maximum: number): string {
  requireValue(typeof value === 'string' && value.length <= maximum);
  return value;
}

function id(value: unknown): string {
  const result = text(value, 36);
  requireValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      result
    )
  );
  return result;
}

function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  requireValue(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= minimum &&
      value <= maximum
  );
  return value;
}

function timestamp(value: unknown): string {
  const result = text(value, 24);
  const date = new Date(result);
  requireValue(!Number.isNaN(date.valueOf()) && date.toISOString() === result);
  return result;
}

function url(value: unknown, maximum: number): string | null {
  if (value === null) return null;
  const result = text(value, maximum);
  try {
    const parsed = new URL(result);
    requireValue(
      ['https:', 'http:'].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password
    );
  } catch {
    throw new CatalogUnavailableError('Invalid catalog URL');
  }
  return result;
}

function facet(value: unknown): CatalogFacet {
  const row = object(value);
  const name = text(row['name'], 255);
  requireValue(name.trim().length > 0);
  return { id: id(row['id']), slug: catalogSlug(row['slug']), name };
}

function list<T extends CatalogFacet>(
  value: unknown,
  maximum: number,
  parse: (row: unknown) => T
): T[] {
  requireValue(Array.isArray(value) && value.length <= maximum);
  const result = value.map(parse);
  requireValue(
    new Set(result.map((item) => item.id)).size === result.length &&
      new Set(result.map((item) => item.slug)).size === result.length
  );
  return result;
}

export function parseCatalogFacets(value: unknown): CatalogFacets {
  const row = object(value);
  const categories = list(row['categories'], 2000, (entry): CatalogCategory => {
    const category = object(entry);
    return {
      ...facet(category),
      parentId: category['parentId'] === null ? null : id(category['parentId']),
    };
  });
  const byId = new Map(categories.map((category) => [category.id, category]));
  for (const category of categories) {
    const visited = new Set<string>();
    let current: string | null = category.id;
    while (current !== null) {
      const parent = byId.get(current);
      requireValue(parent && !visited.has(current) && visited.size < 64);
      visited.add(current);
      current = parent.parentId;
    }
  }
  return {
    categories,
    tags: list(row['tags'], 2000, facet),
    platforms: list(row['platforms'], 2000, facet),
    devices: list(row['devices'], 2000, facet),
    monetizations: list(row['monetizations'], 2000, facet),
  };
}

/** Parse untrusted transport values without casting them into a successful contract. */
export function parseCatalogApp(value: unknown): CatalogApp {
  const row = object(value);
  requireValue(typeof row['isPwa'] === 'boolean');
  let reviews: CatalogApp['reviews'] = null;
  if (row['reviews'] !== null) {
    const aggregate = object(row['reviews']);
    const total = integer(aggregate['total'], 0);
    const rating = aggregate['rating'];
    requireValue(
      rating === null ||
        (typeof rating === 'number' &&
          Number.isFinite(rating) &&
          rating >= 0 &&
          rating <= 5)
    );
    requireValue(total !== 0 || rating === null);
    reviews = { total, rating };
  }
  return {
    id: id(row['id']),
    revision: integer(row['revision'], 1),
    slug: catalogSlug(row['slug']),
    name: facet(row).name,
    description:
      row['description'] === null ? null : text(row['description'], 65536),
    website: url(row['website'], 2048),
    logoUrl: url(row['logoUrl'], 500),
    bannerUrl: url(row['bannerUrl'], 500),
    isPwa: row['isPwa'],
    estimatedNumberOfUsers:
      row['estimatedNumberOfUsers'] === null
        ? null
        : integer(row['estimatedNumberOfUsers'], 0),
    createdAt: timestamp(row['createdAt']),
    updatedAt: timestamp(row['updatedAt']),
    categories: list(row['categories'], 64, facet),
    tags: list(row['tags'], 50, facet),
    platforms: list(row['platforms'], 50, facet),
    devices: list(row['devices'], 50, facet),
    monetizations: list(row['monetizations'], 50, facet),
    reviews,
    ...classificationFields(row['classification'], CatalogUnavailableError),
  };
}

export function parseCatalogPage(value: unknown): CatalogPage {
  const row = object(value);
  const total = integer(row['total'], 0);
  const pageSize = integer(row['pageSize'], 1, 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  requireValue(row['totalPages'] === totalPages);
  const page = integer(row['page'], 1, Math.min(totalPages, 10000));
  requireValue(
    Array.isArray(row['items']) &&
      row['items'].length === Math.min(pageSize, total - (page - 1) * pageSize)
  );
  const items = row['items'].map(parseCatalogApp);
  requireValue(
    new Set(items.map((app) => app.id)).size === items.length &&
      new Set(items.map((app) => app.slug)).size === items.length
  );
  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    facets: parseCatalogFacets(row['facets']),
  };
}

/** Reject extra, duplicate or reordered records from an upstream selection. */
export function parseCatalogSelection(
  value: unknown,
  requestedIds: string[]
): CatalogSelection {
  const ids = catalogAppIds(requestedIds);
  const row = object(value);
  requireValue(
    Array.isArray(row['items']) && row['items'].length <= ids.length
  );
  const items = row['items'].map(parseCatalogApp);
  let previous = -1;
  for (const app of items) {
    const position = ids.indexOf(app.id);
    requireValue(position > previous);
    previous = position;
  }
  requireValue(new Set(items.map((app) => app.slug)).size === items.length);
  return { items };
}
