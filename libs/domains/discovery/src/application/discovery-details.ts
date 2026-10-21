import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';

export interface DiscoveryTag {
  slug: string;
  name: string;
}
export interface DiscoveryApplication extends ClassifiedContent {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
}
export interface DiscoveryReviews {
  total: number;
  rating: number | null;
  preview: {
    id: string;
    byline: string;
    rating: number;
    text: string;
    publishedAt: number;
  } | null;
}
export type DiscoveryDetails =
  | { kind: 'application'; logoUrl: string | null; reviews: DiscoveryReviews }
  | {
      kind: 'article';
      byline: string;
      cover: { imageId: string; alt: string } | null;
    }
  | {
      kind: 'suite';
      applicationCount: number;
      applications: DiscoveryApplication[];
    };

function requireValue(value: unknown): asserts value {
  if (!value) throw new Error('Invalid search preview');
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  requireValue(
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
  );
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  requireValue(
    typeof value === 'string' && value.trim() && value.length <= max
  );
  requireValue(![...value].some(character => {
    const code = character.charCodeAt(0);
    return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
  }));
  return value;
}
function integer(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  requireValue(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max
  );
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
function image(value: unknown): string | null {
  if (value === null) return null;
  const result = text(value, 500),
    url = new URL(result);
  requireValue(
    ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  );
  return result;
}
export function parseDiscoveryTags(value: unknown): DiscoveryTag[] {
  requireValue(Array.isArray(value) && value.length <= 50);
  const tags = value.map((entry) => {
    const row = object(entry, ['slug', 'name']);
    return { slug: text(row['slug'], 255), name: text(row['name'], 255) };
  });
  requireValue(new Set(tags.map((tag) => tag.slug)).size === tags.length);
  return tags;
}
export function parseDiscoveryDetails(
  value: unknown,
  kind: DiscoveryDetails['kind']
): DiscoveryDetails {
  if (kind === 'application') {
    const row = object(value, ['kind', 'logoUrl', 'reviews']);
    requireValue(row['kind'] === kind);
    const reviews = object(row['reviews'], ['total', 'rating', 'preview']);
    const total = integer(reviews['total'], 0),
      rating = reviews['rating'];
    requireValue(
      total === 0
        ? rating === null
        : typeof rating === 'number' &&
            Number.isFinite(rating) &&
            rating >= 1 &&
            rating <= 5
    );
    const preview =
      reviews['preview'] === null
        ? null
        : object(reviews['preview'], [
            'id',
            'byline',
            'rating',
            'text',
            'publishedAt',
          ]);
    requireValue(!preview || total > 0);
    return {
      kind,
      logoUrl: image(row['logoUrl']),
      reviews: {
        total,
        rating: rating as number | null,
        preview: preview
          ? {
              id: id(preview['id']),
              byline: text(preview['byline'], 80),
              rating: integer(preview['rating'], 1, 5),
              text: text(preview['text'], 1000),
              publishedAt: integer(
                preview['publishedAt'],
                1,
                8_640_000_000_000_000
              ),
            }
          : null,
      },
    };
  }
  if (kind === 'article') {
    const row = object(value, ['kind', 'byline', 'cover']);
    requireValue(row['kind'] === kind);
    const cover =
      row['cover'] === null ? null : object(row['cover'], ['imageId', 'alt']);
    return {
      kind,
      byline: text(row['byline'], 100),
      cover: cover
        ? { imageId: id(cover['imageId']), alt: text(cover['alt'], 300) }
        : null,
    };
  }
  const row = object(value, ['kind', 'applicationCount', 'applications']);
  requireValue(row['kind'] === kind);
  const applicationCount = integer(row['applicationCount'], 1, 50),
    entries = row['applications'];
  requireValue(
    Array.isArray(entries) && entries.length <= Math.min(6, applicationCount)
  );
  const applications = entries.map((entry) => {
    const row = object(entry, [
      'id',
      'slug',
      'name',
      'logoUrl',
      ...(entry && typeof entry === 'object' && 'classification' in entry
        ? ['classification']
        : []),
    ]);
    const slug = text(row['slug'], 255);
    requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
    return {
      id: id(row['id']),
      slug,
      name: text(row['name'], 255),
      logoUrl: image(row['logoUrl']),
      ...classificationFields(row['classification']),
    };
  });
  requireValue(
    new Set(applications.map((app) => app.id)).size === applications.length
  );
  return { kind, applicationCount, applications };
}
