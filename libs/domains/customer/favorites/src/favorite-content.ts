import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseAccountFavorites,
  parseFavoriteTarget,
  FavoritesContractError,
  type FavoriteTarget,
} from './account-favorites';
import { favoriteUpdateObject } from './favorite-updates';

export interface ResolvedFavoriteContent
  extends FavoriteTarget,
    ClassifiedContent {
  name: string;
  slug: string | null;
  status: 'available' | 'unavailable';
  appSlug?: string;
  image?: string;
}

export function parseFavoriteContent(
  input: unknown,
  requested?: FavoriteTarget[]
) {
  const row = favoriteUpdateObject(input, ['identityId', 'revision', 'items']);
  if (
    !Array.isArray(row['items']) ||
    row['items'].length > ACCOUNT_FAVORITES_LIMIT
  )
    throw new FavoritesContractError('Invalid favorite content');
  const items = row['items'].map((input): ResolvedFavoriteContent => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new FavoritesContractError('Invalid favorite content item');
    const item = input as Record<string, unknown>;
    const keys = [
      'kind',
      'id',
      'name',
      'slug',
      'status',
      'classification',
      'image',
      'appSlug',
    ];
    if (Object.keys(item).some((key) => !keys.includes(key)))
      throw new FavoritesContractError('Unknown favorite content field');
    const target = parseFavoriteTarget({ kind: item['kind'], id: item['id'] });
    const name = item['name'];
    if (typeof name !== 'string' || !name.trim() || name.length > 300)
      throw new FavoritesContractError('Invalid favorite name');
    if (item['status'] === 'unavailable') {
      if (
        item['slug'] !== null ||
        ['image', 'appSlug', 'classification'].some((key) => key in item)
      )
        throw new FavoritesContractError(
          'Unavailable favorite contains metadata'
        );
      return { ...target, name, slug: null, status: 'unavailable' };
    }
    const slug = item['slug'];
    if (
      item['status'] !== 'available' ||
      typeof slug !== 'string' ||
      slug.length > 255 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    )
      throw new FavoritesContractError('Invalid favorite link');
    if (['suites', 'discussions'].includes(target.kind) && slug !== target.id)
      throw new FavoritesContractError('Favorite ID differs');
    const appSlug = item['appSlug'];
    if (
      target.kind === 'discussions'
        ? typeof appSlug !== 'string' ||
          appSlug.length > 255 ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appSlug)
        : appSlug !== undefined
    )
      throw new FavoritesContractError('Invalid favorite parent');
    const image = item['image'];
    if (image !== undefined) {
      if (typeof image !== 'string' || image.length > 2048)
        throw new FavoritesContractError('Invalid favorite image');
      const url = new URL(image);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new FavoritesContractError('Invalid favorite image');
    }
    return {
      ...target,
      name,
      slug,
      status: 'available',
      ...classificationFields(item['classification'], FavoritesContractError),
      ...(appSlug === undefined ? {} : { appSlug: appSlug as string }),
      ...(image === undefined ? {} : { image: image as string }),
    };
  });
  const account = parseAccountFavorites({
    identityId: row['identityId'],
    revision: row['revision'],
    favorites: items.map((item) => ({
      kind: item.kind,
      id: item.id,
      addedAt: 1,
    })),
  });
  if (requested) {
    const keys = new Set(
      requested.map((item) => {
        const target = parseFavoriteTarget(item);
        return `${target.kind}:${target.id}`;
      })
    );
    if (
      keys.size !== requested.length ||
      items.length !== requested.length ||
      items.some((item) => !keys.has(`${item.kind}:${item.id}`))
    )
      throw new FavoritesContractError('Saved favorites changed; reload');
  }
  return { identityId: account.identityId, revision: account.revision, items };
}
