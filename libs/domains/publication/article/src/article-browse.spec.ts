import {
  parseArticleBrowseQuery,
  parseArticlePage,
  parseArticleReviewPage,
} from './article-workspace';

describe('article discovery pagination', () => {
  it('retains old contracts and accepts explicit bounded sorting and page size', () => {
    expect(parseArticleBrowseQuery({})).toEqual({
      q: '',
      category: '',
      tag: '',
      page: 1,
    });
    expect(
      parseArticleBrowseQuery({ pageSize: '100', sort: 'name-desc' })
    ).toMatchObject({ pageSize: 100, sort: 'name-desc' });
    expect(
      parseArticlePage({ items: [], total: 0, page: 1, pageSize: 100 })
    ).toEqual({ items: [], total: 0, page: 1, pageSize: 100 });
    expect(() =>
      parseArticleReviewPage({ items: [], total: 0, page: 1, pageSize: 100 })
    ).toThrow();
  });
  it.each([
    { pageSize: '0' },
    { pageSize: '101' },
    { pageSize: ['20'] },
    { pageSize: '2.5' },
    { sort: 'popular' },
  ])('rejects %j', (input) =>
    expect(() => parseArticleBrowseQuery(input)).toThrow()
  );
});
