export const FAVORITE_KINDS = [
  'applications',
  'suites',
  'articles',
  'discussions',
] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];
export const ACCOUNT_FAVORITES_LIMIT = 200;

export interface FavoriteTarget {
  kind: FavoriteKind;
  id: string;
}

export interface SavedFavorite extends FavoriteTarget {
  addedAt: number;
}

export interface AccountFavorites {
  identityId: string;
  revision: number;
  favorites: SavedFavorite[];
}

export interface FavoriteChange {
  expectedRevision: number;
  target: FavoriteTarget;
  saved: boolean;
}

export interface FavoriteChangeReceipt {
  identityId: string;
  revision: number;
}

export class FavoritesContractError extends Error {}

function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new FavoritesContractError(message);
}

function fields(value: unknown, keys: string[]): Record<string, unknown> {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Expected favorites object'
  );
  const result = Object.fromEntries(Object.entries(value));
  requireValue(
    Object.keys(result).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(result, key)),
    'Missing or unknown favorites field'
  );
  return result;
}

function revision(value: unknown): number {
  requireValue(
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
    'Invalid account revision'
  );
  return value;
}

function identity(value: unknown): string {
  requireValue(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 128 &&
      value.trim() === value &&
      ![...value].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ),
    'Invalid account identity'
  );
  return value;
}

export function parseFavoriteTarget(value: unknown): FavoriteTarget {
  const row = fields(value, ['kind', 'id']);
  const kind = FAVORITE_KINDS.find((kind) => kind === row['kind']);
  requireValue(kind, 'Unsupported favorite kind');
  const id = row['id'];
  requireValue(
    typeof id === 'string' &&
      id.length === 36 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id
      ),
    'Expected a canonical favorite target ID'
  );
  return { kind, id };
}

export function parseFavoriteChange(value: unknown): FavoriteChange {
  const row = fields(value, ['expectedRevision', 'target', 'saved']);
  requireValue(typeof row['saved'] === 'boolean', 'Expected saved boolean');
  const expectedRevision = revision(row['expectedRevision']);
  requireValue(
    expectedRevision < Number.MAX_SAFE_INTEGER,
    'Account revision exhausted'
  );
  return {
    expectedRevision,
    target: parseFavoriteTarget(row['target']),
    saved: row['saved'],
  };
}

export function parseAccountFavorites(value: unknown): AccountFavorites {
  const row = fields(value, ['identityId', 'revision', 'favorites']);
  const values = row['favorites'];
  requireValue(
    Array.isArray(values) && values.length <= ACCOUNT_FAVORITES_LIMIT,
    'Favorite limit exceeded'
  );
  const favorites = Array.from(values, (entry): SavedFavorite => {
    const item = fields(entry, ['kind', 'id', 'addedAt']);
    const addedAt = revision(item['addedAt']);
    requireValue(
      addedAt <= 8_640_000_000_000_000,
      'Invalid favorite timestamp'
    );
    return {
      ...parseFavoriteTarget({ kind: item['kind'], id: item['id'] }),
      addedAt,
    };
  });
  requireValue(
    new Set(favorites.map((item) => `${item.kind}:${item.id}`)).size ===
      favorites.length,
    'Duplicate saved favorite'
  );
  return {
    identityId: identity(row['identityId']),
    revision: revision(row['revision']),
    favorites,
  };
}

export function parseFavoriteChangeReceipt(
  value: unknown
): FavoriteChangeReceipt {
  const row = fields(value, ['identityId', 'revision']);
  return {
    identityId: identity(row['identityId']),
    revision: revision(row['revision']),
  };
}
