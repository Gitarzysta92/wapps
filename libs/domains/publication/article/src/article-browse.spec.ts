import {
  parseArticleBrowseQuery,
  parseArticlePage,
  parseArticleReviewPage,
  articleBrowseTags,
  articleBrowseParameters,
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
    { tags: 'one,,two' },
    { tags: 'one,Two' },
    { tags: { tag: 'one' } },
    { tags: [1] },
    { tags: ['one,two'] },
    { tags: new Array(13).fill('one') },
    { tags: Array.from({ length: 12 }, (_, i) => `tag-${i}`), tag: 'extra' },
  ])('rejects %j', (input) =>
    expect(() => parseArticleBrowseQuery(input)).toThrow()
  );
  it('normalizes bounded tag sets without changing the legacy single-tag shape', () => {
    for (const tags of ['web,offline,web', ['web', 'offline', 'web']]) {
      const query = parseArticleBrowseQuery({ tag: 'privacy', tags });
      expect(query.tags).toEqual(['offline', 'web']);
      expect(articleBrowseTags(query)).toEqual(['offline', 'privacy', 'web']);
      expect(parseArticleBrowseQuery(articleBrowseParameters(query))).toEqual(
        query
      );
    }
    expect(parseArticleBrowseQuery({ tags: '' }).tags).toEqual([]);
    expect(articleBrowseTags(parseArticleBrowseQuery({ tag: 'web' }))).toEqual([
      'web',
    ]);
    expect(
      parseArticleBrowseQuery({
        tags: Array.from({ length: 12 }, (_, i) => `tag-${i}`),
      }).tags
    ).toHaveLength(12);
  });
});
