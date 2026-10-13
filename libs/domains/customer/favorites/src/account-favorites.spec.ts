import {
  ACCOUNT_FAVORITES_LIMIT,
  FAVORITE_KINDS,
  parseAccountFavorites,
  parseFavoriteChange,
  parseFavoriteChangeReceipt,
  parseFavoriteTarget,
} from './account-favorites';

const id = '019a0010-0000-7000-8000-000000000001';
const target = { kind: 'applications', id };
const change = { expectedRevision: 2, target, saved: true };
const account = {
  identityId: 'Uid',
  revision: 2,
  favorites: [{ ...target, addedAt: 100 }],
};

describe('canonical favorites contract', () => {
  it('preserves canonical identities without accepting copied metadata', () => {
    for (const kind of FAVORITE_KINDS)
      expect(parseFavoriteTarget({ kind, id })).toEqual({ kind, id });
    expect(parseAccountFavorites(account)).toEqual(account);
    expect(parseFavoriteChange(change)).toEqual(change);
    expect(
      parseFavoriteChangeReceipt({ identityId: 'Uid', revision: 3 })
    ).toEqual({ identityId: 'Uid', revision: 3 });
    expect(
      parseAccountFavorites({ ...account, favorites: [] }).favorites
    ).toEqual([]);
  });
  it.each([
    null,
    [],
    {},
    { kind: 'app', id },
    { ...target, id: 'mutable-slug' },
    { ...target, id: id.toUpperCase() },
    { ...target, id: id + '\n' },
    { ...target, name: 'Copied projection' },
    { ...target, tenantId: 'private' },
  ])('rejects ambiguous, malformed or injected targets: %j', (value) =>
    expect(() => parseFavoriteTarget(value)).toThrow()
  );
  it.each([
    { ...change, expectedRevision: 0 },
    { ...change, expectedRevision: Number.MAX_SAFE_INTEGER },
    { ...change, expectedRevision: '2' },
    { ...change, expectedRevision: 1.1 },
    { ...change, saved: 'false' },
    { ...change, identityId: 'Other' },
    { ...change, target: { ...target, slug: 'x' } },
  ])('rejects invalid commands: %j', (value) =>
    expect(() => parseFavoriteChange(value)).toThrow()
  );
  it.each([
    { ...account, identityId: ' Uid' },
    { ...account, identityId: '' },
    { ...account, revision: 0 },
    { ...account, favorites: new Array(1) },
    { ...account, favorites: [...account.favorites, ...account.favorites] },
    { ...account, favorites: [{ ...target, addedAt: '100' }] },
    { ...account, favorites: [{ ...target, addedAt: 8_640_000_000_000_001 }] },
    {
      ...account,
      favorites: new Array(ACCOUNT_FAVORITES_LIMIT + 1).fill(
        account.favorites[0]
      ),
    },
    { ...account, profile: {} },
  ])('rejects malformed stored/transport snapshots: %j', (value) =>
    expect(() => parseAccountFavorites(value)).toThrow()
  );
  it('keys relations by both target family and canonical ID', () => {
    expect(
      parseAccountFavorites({
        ...account,
        favorites: FAVORITE_KINDS.map((kind) => ({ kind, id, addedAt: 100 })),
      }).favorites
    ).toHaveLength(4);
  });
});
