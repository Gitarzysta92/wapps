import {
  DiscoveryInputError,
  parsePublicDiscovery,
  parsePublicDiscoveryQuery,
  publicDiscoveryParameters,
  selectPublicDiscovery,
} from './public-discovery';

const item = {
  id: '10000000-0000-4000-8000-000000000001',
  revision: 2,
  slug: 'example',
  title: 'Example',
  classification: 'general',
  summary: 'Approved summary',
  at: 1234,
  categories: ['productivity'],
  tags: [],
};
const query = parsePublicDiscoveryQuery({ type: 'application' });
const result = {
  groups: [
    {
      kind: 'application',
      items: [item],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    },
  ],
};

describe('public grouped discovery', () => {
  it('normalizes legacy aliases, repeated facets and independent page state', () => {
    const parsed = parsePublicDiscoveryQuery({
      q: '  photo  editor ',
      type: 'applications',
      category: ['photo', 'photo'],
      tags: ['web', 'web'],
      page: '3',
      applicationPage: '2',
      sort: 'newest',
      pageSize: '100',
    });
    expect(parsed).toMatchObject({
      search: 'photo editor',
      kinds: ['application'],
      categories: ['photo'],
      tags: ['web'],
      pages: { application: 2, article: 3, suite: 3 },
      pageSize: 100,
    });
    expect(
      parsePublicDiscoveryQuery(publicDiscoveryParameters(parsed))
    ).toEqual(parsed);
    expect(
      parsePublicDiscoveryQuery({ type: ['suites', 'articles'] }).kinds
    ).toEqual(['article', 'suite']);
  });
  it.each([
    { tenantId: 'private' },
    { owner: 'member' },
    { type: 'release' },
    { search: ['one', 'two'] },
    { search: 'x', q: 'y' },
    { search: 'x\nprivate' },
    { search: 'x'.repeat(101) },
    { pageSize: '101' },
    { pageSize: '1e2' },
    { page: '0' },
    { articlePage: '10001' },
    { sort: 'popular' },
    { category: 'work' },
    { type: 'suite', tags: 'work' },
    { type: 'article', platform: 'web' },
    { type: 'article', tags: Array.from({ length: 13 }, (_, i) => `tag-${i}`) },
    { type: 'article', tags: 'one,Invalid' },
    { type: 'application', category: '../private' },
    { social: 'github' },
  ])('rejects unsupported query %j', (input) =>
    expect(() => parsePublicDiscoveryQuery(input)).toThrow(DiscoveryInputError)
  );
  it('keeps article taxonomy distinct from application slugs', () => {
    expect(
      parsePublicDiscoveryQuery({
        type: 'articles',
        category: 'Developer guides',
        tag: 'web',
      })
    ).toMatchObject({ categories: ['Developer guides'], tags: ['web'] });
  });
  it('preserves all article tags across legacy aliases and query serialization', () => {
    const query = parsePublicDiscoveryQuery({
      type: 'articles', category: 'Guides', tag: ['web', 'offline'], tags: 'web,privacy',
    });
    expect(query.tags).toEqual(['offline', 'privacy', 'web']);
    expect(parsePublicDiscoveryQuery(publicDiscoveryParameters(query))).toEqual(query);
  });
  it('validates optional canonical tag names without treating matching keys as labels', () => {
    const response = {
      groups: [
        {
          ...result.groups[0],
          items: [{ ...item, tags: ['tag-key'], tagNames: ['Work tools'] }],
        },
      ],
    };
    expect(parsePublicDiscovery(response, query)).toEqual(response);
    for (const tagNames of [
      null,
      'Work tools',
      [''],
      ['Work tools', 'Work tools'],
      [1],
    ]) {
      expect(() =>
        parsePublicDiscovery(
          { groups: [{ ...result.groups[0], items: [{ ...item, tagNames }] }] },
          query
        )
      ).toThrow(DiscoveryInputError);
    }
    expect(
      parsePublicDiscovery(result, query).groups[0].items[0].tagNames
    ).toBeUndefined();
  });
  it('requires complete, ordered, bounded groups and genuine page counts', () => {
    expect(parsePublicDiscovery(result, query)).toEqual(result);
    const group = result.groups[0];
    for (const patch of [
      { items: [] },
      { total: 2 },
      { page: 2 },
      { pageSize: 10 },
      { totalPages: 2 },
      { kind: 'suite' },
      { items: [item, item], total: 2 },
    ])
      expect(() =>
        parsePublicDiscovery({ groups: [{ ...group, ...patch }] }, query)
      ).toThrow();
    expect(() => parsePublicDiscovery({ groups: [] }, query)).toThrow();
    expect(() =>
      parsePublicDiscovery(result, parsePublicDiscoveryQuery({}))
    ).toThrow();
  });
  it('accepts bounded page correction and rejects private or untrusted destinations', () => {
    expect(
      parsePublicDiscovery(
        result,
        parsePublicDiscoveryQuery({ type: 'application', page: '10000' })
      )
    ).toEqual(result);
    for (const patch of [
      { ownerIdentityId: 'private' },
      { slug: '//evil' },
      { at: -1 },
      { id: 'invented' },
    ])
      expect(() =>
        parsePublicDiscovery(
          { groups: [{ ...result.groups[0], items: [{ ...item, ...patch }] }] },
          query
        )
      ).toThrow();
  });
  it('applies current-page exclusions without inventing a new search total', () => {
    const selected = selectPublicDiscovery(
      parsePublicDiscovery(result, query),
      ['Productivity']
    );
    expect(selected[0]).toMatchObject({ items: [], total: 1, hidden: 1 });
    expect(result.groups[0].items).toHaveLength(1);
  });
  it('hides mature and unclassified publications while preserving source totals', () => {
    for (const classification of [undefined, 'general', 'mature'] as const) {
      const source = parsePublicDiscovery(
        {
          groups: [
            { ...result.groups[0], items: [{ ...item, classification }] },
          ],
        },
        query
      );
      const selected = selectPublicDiscovery(source, [], false)[0];
      expect(selected.items.length).toBe(classification === 'general' ? 1 : 0);
      expect(selected.total).toBe(1);
      expect(selected.hidden).toBe(classification === 'general' ? 0 : 1);
      expect(selectPublicDiscovery(source, [], true)[0].items).toHaveLength(1);
    }
  });
  it('preserves approved publication whitespace while rejecting other control characters', () => {
    for (const kind of ['article', 'suite'] as const) {
      const publication = {
        ...item,
        slug: kind === 'suite' ? null : item.slug,
        title: 'Approved\nmultiline\ttitle',
        summary: 'First line\r\nSecond line',
        categories: kind === 'article' ? ['Developer\nguides'] : [],
      };
      const response = {
        groups: [{ ...result.groups[0], kind, items: [publication] }],
      };
      const selected = parsePublicDiscoveryQuery({ type: kind });
      expect(parsePublicDiscovery(response, selected)).toEqual(response);
      for (const field of ['title', 'summary', 'categories'] as const) {
        const invalid = {
          ...publication,
          [field]:
            field === 'categories' ? ['Bad\u0000category'] : 'Bad\u0000text',
        };
        expect(() =>
          parsePublicDiscovery(
            { groups: [{ ...response.groups[0], items: [invalid] }] },
            selected
          )
        ).toThrow(DiscoveryInputError);
      }
    }
  });
});
