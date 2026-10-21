import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
import {
  FavoritesContractError,
  parseFavoriteTarget,
  type FavoriteTarget,
} from './account-favorites';

export const FAVORITE_UPDATE_PAGE_SIZE = 10;

export interface FavoriteUpdateVersion {
  version: number;
  at: number;
}

export type FavoriteUpdateDestination =
  | { kind: 'applications' | 'articles'; slug: string }
  | { kind: 'suites' }
  | {
      kind: 'discussions';
      parentKind: 'application' | 'article';
      slug: string;
    };

/** The version measures public content changes, independently of projection delivery. */
export interface FavoriteUpdateState extends FavoriteUpdateVersion {
  target: FavoriteTarget;
  content:
    | (ClassifiedContent & {
        title: string;
        destination: FavoriteUpdateDestination;
      })
    | null;
}

export interface FavoriteUpdateItem extends ClassifiedContent {
  id: string;
  target: FavoriteTarget;
  title: string;
  destination: FavoriteUpdateDestination;
  at: number;
  readAt: number | null;
}

export interface FavoriteUpdatePage {
  enabled: boolean;
  items: FavoriteUpdateItem[];
  next: string | null;
}

export function favoriteUpdateObject(
  value: unknown,
  keys: string[],
  optional: string[] = []
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new FavoritesContractError('Expected update object');
  const row = Object.fromEntries(Object.entries(value));
  if (
    Object.keys(row).some(
      (key) => !keys.includes(key) && !optional.includes(key)
    ) ||
    keys.some((key) => !Object.prototype.hasOwnProperty.call(row, key))
  )
    throw new FavoritesContractError('Missing or unknown update field');
  return row;
}

export function favoriteUpdateInteger(value: unknown, minimum = 0): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new FavoritesContractError('Invalid update number');
  return value;
}

export function favoriteUpdateTime(value: unknown): number {
  const result = favoriteUpdateInteger(value);
  if (result > 8_640_000_000_000_000)
    throw new FavoritesContractError('Invalid update time');
  return result;
}

export function favoriteUpdateId(value: unknown): string {
  return parseFavoriteTarget({ kind: 'applications', id: value }).id;
}

export function parseFavoriteUpdateVersion(
  value: unknown
): FavoriteUpdateVersion {
  const row = favoriteUpdateObject(value, ['version', 'at']);
  const version = favoriteUpdateInteger(row['version']),
    at = favoriteUpdateTime(row['at']);
  if ((version === 0) !== (at === 0))
    throw new FavoritesContractError('Inconsistent update version');
  return { version, at };
}

function destination(
  value: unknown,
  target: FavoriteTarget
): FavoriteUpdateDestination {
  const row = favoriteUpdateObject(
    value,
    target.kind === 'suites'
      ? ['kind']
      : target.kind === 'discussions'
      ? ['kind', 'parentKind', 'slug']
      : ['kind', 'slug']
  );
  if (row['kind'] !== target.kind)
    throw new FavoritesContractError('Update destination differs');
  if (target.kind === 'suites') return { kind: 'suites' };
  const slug = row['slug'];
  if (
    typeof slug !== 'string' ||
    slug.length > 200 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    throw new FavoritesContractError('Invalid update destination');
  if (target.kind !== 'discussions') return { kind: target.kind, slug };
  const parentKind = row['parentKind'];
  if (parentKind !== 'application' && parentKind !== 'article')
    throw new FavoritesContractError('Invalid update parent');
  return { kind: 'discussions', parentKind, slug };
}

function title(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 300)
    throw new FavoritesContractError('Invalid update title');
  return value;
}

export function parseFavoriteUpdateState(value: unknown): FavoriteUpdateState {
  const row = favoriteUpdateObject(value, [
    'target',
    'version',
    'at',
    'content',
  ]);
  const target = parseFavoriteTarget(row['target']);
  const version = parseFavoriteUpdateVersion({
    version: row['version'],
    at: row['at'],
  });
  const content =
    row['content'] === null
      ? null
      : favoriteUpdateObject(
          row['content'],
          ['title', 'destination'],
          ['classification']
        );
  return {
    target,
    ...version,
    content:
      content === null
        ? null
        : {
            ...classificationFields(content['classification']),
            title: title(content['title']),
            destination: destination(content['destination'], target),
          },
  };
}

export function favoriteUpdateCursor(
  value: unknown
): { at: number; id: string } | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{1,16}\.[0-9a-f-]{36}$/.test(value))
    throw new FavoritesContractError('Invalid update cursor');
  const [at, id] = value.split('.');
  const result = {
    at: favoriteUpdateTime(Number(at)),
    id: favoriteUpdateId(id),
  };
  if (`${result.at}.${result.id}` !== value)
    throw new FavoritesContractError('Invalid update cursor');
  return result;
}

export function parseFavoriteUpdatePage(value: unknown): FavoriteUpdatePage {
  const row = favoriteUpdateObject(value, ['enabled', 'items', 'next']);
  if (
    typeof row['enabled'] !== 'boolean' ||
    !Array.isArray(row['items']) ||
    row['items'].length > FAVORITE_UPDATE_PAGE_SIZE ||
    row['next'] === undefined
  )
    throw new FavoritesContractError('Invalid update page');
  const next = favoriteUpdateCursor(row['next']);
  const items = row['items'].map((input): FavoriteUpdateItem => {
    const item = favoriteUpdateObject(
      input,
      ['id', 'target', 'title', 'destination', 'at', 'readAt'],
      ['classification']
    );
    const target = parseFavoriteTarget(item['target']),
      at = favoriteUpdateTime(item['at']);
    const readAt =
      item['readAt'] === null ? null : favoriteUpdateTime(item['readAt']);
    if (readAt !== null && readAt < at)
      throw new FavoritesContractError('Invalid update read time');
    return {
      id: favoriteUpdateId(item['id']),
      target,
      ...classificationFields(item['classification']),
      title: title(item['title']),
      destination: destination(item['destination'], target),
      at,
      readAt,
    };
  });
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    (!row['enabled'] && (items.length || next))
  )
    throw new FavoritesContractError('Inconsistent update page');
  return {
    enabled: row['enabled'],
    items,
    next: next ? `${next.at}.${next.id}` : null,
  };
}
