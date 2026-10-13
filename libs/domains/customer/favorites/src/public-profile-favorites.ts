import {
  ACCOUNT_FAVORITES_LIMIT,
  FavoritesContractError,
  parseFavoriteTarget,
  type FavoriteTarget,
} from './account-favorites';

export const PUBLIC_PROFILE_FAVORITES_PAGE_SIZE = 20;

export interface PublicProfileFavorite extends FavoriteTarget {
  title: string;
  slug: string;
  applicationSlug: string | null;
}
export interface PublicProfileFavoritesPage {
  sharing: 'visible' | 'hidden';
  items: PublicProfileFavorite[];
  after: string | null;
}

function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new FavoritesContractError(message);
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected public favorites object'
  );
  requireValue(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
    'Missing or unknown public favorites field'
  );
  return value as Record<string, unknown>;
}
function slug(value: unknown): string {
  requireValue(
    typeof value === 'string' &&
      value.length <= 255 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    'Invalid favorite content link'
  );
  return value;
}
export function publicFavoriteKey(target: FavoriteTarget): string {
  return `${target.kind}:${target.id}`;
}
export function parsePublicFavoritesCursor(value: unknown): string | null {
  if (value === null) return null;
  requireValue(
    typeof value === 'string' && value.length <= 53,
    'Invalid public favorites cursor'
  );
  const [kind, id, extra] = value.split(':');
  requireValue(extra === undefined, 'Invalid public favorites cursor');
  const parsed = parseFavoriteTarget({ kind, id });
  return publicFavoriteKey(parsed);
}
export function parsePublicProfileFavorite(
  value: unknown
): PublicProfileFavorite {
  const row = object(value, ['kind', 'id', 'title', 'slug', 'applicationSlug']);
  const target = parseFavoriteTarget({ kind: row['kind'], id: row['id'] });
  const title = row['title'];
  requireValue(
    typeof title === 'string' &&
      title.length > 0 &&
      title.length <= 255 &&
      title === title.trim() &&
      !Array.from(title).some(
        (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127
      ),
    'Invalid favorite title'
  );
  const contentSlug = slug(row['slug']);
  if (target.kind === 'suites' || target.kind === 'discussions')
    requireValue(contentSlug === target.id, 'Favorite content ID mismatch');
  requireValue(
    target.kind === 'discussions' || row['applicationSlug'] === null,
    'Unexpected favorite parent'
  );
  return {
    ...target,
    title,
    slug: contentSlug,
    applicationSlug:
      target.kind === 'discussions' ? slug(row['applicationSlug']) : null,
  };
}

/** Bound every selection to canonical saved relations before paging visible content. */
export function publicProfileFavoritesPage(
  input: PublicProfileFavorite[],
  targets: FavoriteTarget[],
  after: string | null
): PublicProfileFavoritesPage {
  const cursor = parsePublicFavoritesCursor(after);
  requireValue(
    targets.length <= ACCOUNT_FAVORITES_LIMIT && input.length <= targets.length,
    'Public favorites capacity exceeded'
  );
  const requested = new Set(
    targets.map((target) => publicFavoriteKey(parseFavoriteTarget(target)))
  );
  requireValue(requested.size === targets.length, 'Duplicate saved favorites');
  const items = input.map(parsePublicProfileFavorite);
  requireValue(
    items.every((item) => requested.has(publicFavoriteKey(item))) &&
      new Set(items.map(publicFavoriteKey)).size === items.length,
    'Unexpected public favorite selection'
  );
  const sorted = items
    .filter((item) => cursor === null || publicFavoriteKey(item) > cursor)
    .sort((a, b) => (publicFavoriteKey(a) < publicFavoriteKey(b) ? -1 : 1));
  const page = sorted.slice(0, PUBLIC_PROFILE_FAVORITES_PAGE_SIZE);
  return {
    sharing: 'visible',
    items: page,
    after:
      sorted.length > page.length
        ? publicFavoriteKey(page[page.length - 1])
        : null,
  };
}
export function parsePublicProfileFavoritesPage(
  input: unknown
): PublicProfileFavoritesPage {
  const row = object(input, ['sharing', 'items', 'after']);
  requireValue(
    row['sharing'] === 'visible' || row['sharing'] === 'hidden',
    'Invalid favorites sharing'
  );
  requireValue(
    Array.isArray(row['items']) &&
      row['items'].length <= PUBLIC_PROFILE_FAVORITES_PAGE_SIZE,
    'Invalid public favorites page'
  );
  const items = row['items'].map(parsePublicProfileFavorite);
  const after = parsePublicFavoritesCursor(row['after']);
  requireValue(
    row['sharing'] !== 'hidden' || (!items.length && after === null),
    'Hidden favorites contain data'
  );
  requireValue(
    items.every(
      (item, index) =>
        index === 0 ||
        publicFavoriteKey(items[index - 1]) < publicFavoriteKey(item)
    ),
    'Invalid public favorites ordering'
  );
  requireValue(
    after === null ||
      (items.length === PUBLIC_PROFILE_FAVORITES_PAGE_SIZE &&
        after === publicFavoriteKey(items[items.length - 1])),
    'Invalid public favorites continuation'
  );
  return { sharing: row['sharing'], items, after };
}
