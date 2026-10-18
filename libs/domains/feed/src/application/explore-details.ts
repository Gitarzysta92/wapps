import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';

export interface ActivityApplication extends ClassifiedContent {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
}
export interface ActivityTag {
  name: string;
  slug: string;
}
export interface ActivityReviews {
  total: number;
  rating: number | null;
}
export type ActivityDetails =
  | {
      kind: 'application';
      revision: number;
      description: string;
      logoUrl: string | null;
      bannerUrl: string | null;
      category: ActivityTag | null;
      tags: ActivityTag[];
      reviews: ActivityReviews | null;
    }
  | {
      kind: 'article';
      byline: string;
      excerpt: string;
      category: string;
      publishedAt: number;
      cover: { imageId: string; alt: string } | null;
      tags: ActivityTag[];
    }
  | {
      kind: 'suite';
      description: string;
      applicationCount: number;
      applications: ActivityApplication[];
    }
  | {
      kind: 'release';
      applicationName: string;
      logoUrl: string | null;
      description: string;
      releasedOn: string;
      channel: 'stable' | 'prerelease';
      releaseType: 'major' | 'minor' | 'patch';
      changeCount: number;
      changes: {
        type: 'feature' | 'fix' | 'improvement' | 'breaking' | 'security';
        description: string;
      }[];
    }
  | {
      kind: 'review';
      applicationName: string;
      logoUrl: string | null;
      byline: string;
      rating: number;
      text: string;
      publishedAt: number;
    }
  | {
      kind: 'discussion';
      applicationName: string;
      replyCount: number;
      posts: {
        id: string;
        byline: string;
        text: string;
        publishedAt: number;
      }[];
    };

function requireValue(value: unknown): asserts value {
  if (!value) throw new Error('Invalid activity details');
}
function object(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  requireValue(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum: number, minimum = 0): string {
  requireValue(
    typeof value === 'string' &&
      value.length >= minimum &&
      value.length <= maximum
  );
  requireValue(
    ![...value].some(
      (c) =>
        c.charCodeAt(0) === 127 ||
        (c.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(c))
    )
  );
  return value;
}
function integer(
  value: unknown,
  min = 0,
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
  const result = text(value, 36, 36);
  requireValue(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      result
    )
  );
  return result;
}
function slug(value: unknown): string {
  const result = text(value, 255, 1);
  requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result));
  return result;
}
function image(value: unknown): string | null {
  if (value === null) return null;
  const result = text(value, 500, 1),
    url = new URL(result);
  requireValue(
    ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  );
  return result;
}
function list<T>(
  value: unknown,
  max: number,
  parse: (entry: unknown) => T
): T[] {
  requireValue(Array.isArray(value) && value.length <= max);
  return value.map(parse);
}
function tag(value: unknown): ActivityTag {
  const row = object(value, ['name', 'slug']);
  return { name: text(row['name'], 255, 1), slug: text(row['slug'], 255, 1) };
}
function timestamp(value: unknown): number {
  return integer(value, 1, 8_640_000_000_000_000);
}
export function parseActivityReviews(value: unknown): ActivityReviews {
  const row = object(value, ['total', 'rating']);
  const total = integer(row['total']),
    rating = row['rating'];
  requireValue(
    total === 0
      ? rating === null
      : typeof rating === 'number' &&
          Number.isFinite(rating) &&
          rating >= 1 &&
          rating <= 5
  );
  return { total, rating: rating as number | null };
}
function application(value: unknown): ActivityApplication {
  const classified =
    value !== null && typeof value === 'object' && 'classification' in value;
  const row = object(value, [
    'id',
    'slug',
    'name',
    'description',
    'logoUrl',
    ...(classified ? ['classification'] : []),
  ]);
  return {
    id: id(row['id']),
    slug: slug(row['slug']),
    name: text(row['name'], 255, 1),
    description: text(row['description'], 600),
    logoUrl: image(row['logoUrl']),
    ...classificationFields(row['classification']),
  };
}

/** Bounded public preview values only: no identity IDs, mutable media references or private payloads. */
export function parseActivityDetails(
  value: unknown,
  kind: ActivityDetails['kind']
): ActivityDetails {
  const fields: Record<ActivityDetails['kind'], string[]> = {
    application: [
      'revision',
      'description',
      'logoUrl',
      'bannerUrl',
      'category',
      'tags',
      'reviews',
    ],
    article: ['byline', 'excerpt', 'category', 'publishedAt', 'cover', 'tags'],
    suite: ['description', 'applicationCount', 'applications'],
    release: [
      'applicationName',
      'logoUrl',
      'description',
      'releasedOn',
      'channel',
      'releaseType',
      'changeCount',
      'changes',
    ],
    review: [
      'applicationName',
      'logoUrl',
      'byline',
      'rating',
      'text',
      'publishedAt',
    ],
    discussion: ['applicationName', 'replyCount', 'posts'],
  };
  const row = object(value, ['kind', ...fields[kind]]);
  requireValue(row['kind'] === kind);
  switch (kind) {
    case 'application':
      return {
        kind,
        revision: integer(row['revision'], 1),
        description: text(row['description'], 1000),
        logoUrl: image(row['logoUrl']),
        bannerUrl: image(row['bannerUrl']),
        category: row['category'] === null ? null : tag(row['category']),
        tags: list(row['tags'], 50, tag),
        reviews:
          row['reviews'] === null ? null : parseActivityReviews(row['reviews']),
      };
    case 'article': {
      const cover =
        row['cover'] === null ? null : object(row['cover'], ['imageId', 'alt']);
      return {
        kind,
        byline: text(row['byline'], 120, 1),
        excerpt: text(row['excerpt'], 1000),
        category: text(row['category'], 120, 1),
        publishedAt: timestamp(row['publishedAt']),
        cover: cover
          ? { imageId: id(cover['imageId']), alt: text(cover['alt'], 300, 1) }
          : null,
        tags: list(row['tags'], 50, tag),
      };
    }
    case 'suite': {
      const applications = list(row['applications'], 4, application),
        applicationCount = integer(row['applicationCount'], 1, 50);
      requireValue(
        applications.length <= applicationCount &&
          new Set(applications.map((app) => app.id)).size ===
            applications.length
      );
      return {
        kind,
        description: text(row['description'], 1000),
        applicationCount,
        applications,
      };
    }
    case 'release': {
      const releasedOn = text(row['releasedOn'], 10, 10);
      requireValue(
        /^\d{4}-\d{2}-\d{2}$/.test(releasedOn) &&
          new Date(releasedOn).toISOString().slice(0, 10) === releasedOn
      );
      const channel = row['channel'],
        releaseType = row['releaseType'];
      requireValue(channel === 'stable' || channel === 'prerelease');
      requireValue(
        releaseType === 'major' ||
          releaseType === 'minor' ||
          releaseType === 'patch'
      );
      const changes = list<
        Extract<ActivityDetails, { kind: 'release' }>['changes'][number]
      >(row['changes'], 5, (entry) => {
        const change = object(entry, ['type', 'description']),
          type = change['type'];
        requireValue(
          type === 'feature' ||
            type === 'fix' ||
            type === 'improvement' ||
            type === 'breaking' ||
            type === 'security'
        );
        return { type, description: text(change['description'], 1000, 1) };
      });
      const changeCount = integer(row['changeCount'], 1, 100);
      requireValue(changes.length === Math.min(5, changeCount));
      return {
        kind,
        applicationName: text(row['applicationName'], 255, 1),
        logoUrl: image(row['logoUrl']),
        description: text(row['description'], 1000),
        releasedOn,
        channel,
        releaseType,
        changes,
        changeCount,
      };
    }
    case 'review':
      return {
        kind,
        applicationName: text(row['applicationName'], 255, 1),
        logoUrl: image(row['logoUrl']),
        byline: text(row['byline'], 80, 1),
        rating: integer(row['rating'], 1, 5),
        text: text(row['text'], 1000, 1),
        publishedAt: timestamp(row['publishedAt']),
      };
    case 'discussion': {
      const posts = list(row['posts'], 3, (entry) => {
        const post = object(entry, ['id', 'byline', 'text', 'publishedAt']);
        return {
          id: id(post['id']),
          byline: text(post['byline'], 80, 1),
          text: text(post['text'], 1000, 1),
          publishedAt: timestamp(post['publishedAt']),
        };
      });
      requireValue(
        posts.length > 0 &&
          new Set(posts.map((post) => post.id)).size === posts.length
      );
      return {
        kind,
        applicationName: text(row['applicationName'], 255, 1),
        replyCount: integer(row['replyCount']),
        posts,
      };
    }
  }
}
