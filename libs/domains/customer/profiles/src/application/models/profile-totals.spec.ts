import {
  parseProfileTotals,
  parseProfileContentTotals,
  profileTotalsRequest,
} from './profile-totals';
describe('profile totals contract', () => {
  const totals = { discussions: 123, favorites: 0, suites: null, articles: 25 };
  it('keeps observed zero distinct from hidden sharing', () =>
    expect(parseProfileTotals(totals)).toEqual(totals));
  it.each([
    -1,
    0.5,
    '0',
    undefined,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects invalid counts %s', (value) =>
    expect(() => parseProfileTotals({ ...totals, favorites: value })).toThrow()
  );
  it('rejects missing or additional scope fields', () => {
    expect(() => parseProfileTotals({ ...totals, owner: 'other' })).toThrow();
    expect(() => parseProfileTotals({ favorites: 0 })).toThrow();
    expect(() =>
      profileTotalsRequest(
        {
          ownerIdentityId: 'owner',
          categories: ['articles'],
          tenantId: 'other',
        },
        ['articles']
      )
    ).toThrow();
  });
  it('accepts only the requested categories in a content response', () => {
    expect(parseProfileContentTotals({ articles: 50 }, ['articles'])).toEqual({
      articles: 50,
    });
    expect(() =>
      parseProfileContentTotals({ articles: 50, suites: 0 }, ['articles'])
    ).toThrow();
    expect(() => parseProfileContentTotals({}, ['articles'])).toThrow();
  });
  it.each(
    [
      [],
      ['articles', 'articles'],
      ['discussions'],
      ['favorites'],
      ['other'],
    ].map((categories) => ({ categories }))
  )('rejects unowned or repeated categories %j', ({ categories }) =>
    expect(() =>
      profileTotalsRequest({ ownerIdentityId: 'owner', categories }, [
        'articles',
        'suites',
      ])
    ).toThrow()
  );
});
