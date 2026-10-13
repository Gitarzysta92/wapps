import {
  parsePublicSuiteQuery,
  parsePublicSuitePage,
} from './suite-publication';

describe('suite discovery pagination', () => {
  it('retains old contracts and accepts explicit bounded sorting and page size', () => {
    expect(parsePublicSuiteQuery({})).toEqual({ q: '', page: 1 });
    expect(
      parsePublicSuiteQuery({ pageSize: '100', sort: 'newest' })
    ).toMatchObject({ pageSize: 100, sort: 'newest' });
    expect(
      parsePublicSuitePage({ items: [], total: 0, page: 1, pageSize: 100 })
    ).toEqual({ items: [], total: 0, page: 1, pageSize: 100 });
    expect(() =>
      parsePublicSuitePage({ items: [], total: 0, page: 10001 })
    ).toThrow();
  });
  it.each([
    { pageSize: '0' },
    { pageSize: '101' },
    { pageSize: ['20'] },
    { pageSize: '2.5' },
    { sort: 'popular' },
    { q: 'invalid\nsearch' },
  ])('rejects %j', (input) =>
    expect(() => parsePublicSuiteQuery(input)).toThrow()
  );
});
