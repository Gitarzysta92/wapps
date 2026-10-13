import { parseDigest, selectDigest, type DigestContent } from './digest';
import { parseExploreRead, type ExploreItem } from './explore';

const uuid = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const entry = (n: number): ExploreItem => ({
  kind: 'discussion',
  id: uuid(n),
  title: `Topic ${n}`,
  at: 10000 - n,
  target: {
    kind: 'discussion',
    id: uuid(n),
    applicationId: uuid(100),
    applicationSlug: 'app',
  },
  categories: ['category'],
  tags: ['tag'],
  engagement: n,
});
function content(): DigestContent {
  return parseDigest({
    latest: { items: [1, 2, 3, 4].map(entry), more: true },
    discussions: { items: [1, 2, 3, 4].map(entry), more: false },
    applications: {
      more: false,
      items: [
        {
          id: uuid(100),
          revision: 1,
          slug: 'app',
          name: 'Application',
          description: 'Real description',
          website: null,
          logoUrl: null,
          bannerUrl: null,
          isPwa: false,
          estimatedNumberOfUsers: null,
          createdAt: '2026-10-13T00:00:00.000Z',
          updatedAt: '2026-10-13T00:00:00.000Z',
          categories: [{ id: uuid(101), slug: 'category', name: 'Category' }],
          tags: [],
          platforms: [],
          devices: [],
          monetizations: [],
          reviews: null,
        },
      ],
    },
    articles: {
      more: false,
      items: [
        {
          id: uuid(200),
          revision: 1,
          submittedRevision: 1,
          publishedAt: 1000,
          updatedAt: 1000,
          title: 'Article',
          slug: 'article',
          excerpt: 'Actual summary',
          category: 'category',
          byline: 'Public author',
          tags: [],
          cover: { imageId: uuid(201), alt: 'Real cover' },
        },
      ],
    },
  });
}
const choices = {
  showMatureContent: true,
  order: 'recent' as const,
  personalize: true,
  preferredCategories: [],
  excludedCategories: [],
  preferredTags: [],
  favorites: new Set<string>(),
};

describe('Digest contract and selection', () => {
  it('applies reviewed classifications separately to every source group and reports bounded hidden counts', () => {
    const source = content();
    source.latest.items[0].classification = 'general';
    source.latest.items[1].classification = 'mature';
    source.applications.items[0].classification = 'mature';
    source.articles.items[0].classification = 'general';
    const selected = selectDigest(source, {
      ...choices,
      showMatureContent: false,
    });
    expect(selected.latest.items.map((item) => item.id)).toEqual([uuid(1)]);
    expect(selected.latest.hidden).toBe(3);
    expect(selected.latest.more).toBe(true);
    expect(selected.discussions.items).toEqual([]);
    expect(selected.discussions.hidden).toBe(4);
    expect(selected.applications.items).toEqual([]);
    expect(selected.applications.hidden).toBe(1);
    expect(selected.articles.items).toEqual(source.articles.items);
    expect(selected.articles.hidden).toBe(0);
    expect(selectDigest(source, choices).applications.items).toHaveLength(1);
  });
  it('preserves actual summaries and covers and bounds each independent section without mutation', () => {
    const source = content(),
      before = JSON.stringify(source);
    const result = selectDigest(source, choices);
    expect(result.latest.items.map((item) => item.id)).toEqual(
      [1, 2, 3].map(uuid)
    );
    expect(result.discussions.items.map((item) => item.id)).toEqual([uuid(1)]);
    expect(result.articles.items[0].cover?.imageId).toBe(uuid(201));
    expect(result.applications.items[0].description).toBe('Real description');
    expect(JSON.stringify(source)).toBe(before);
  });
  it('applies saved exclusions to every content family before limiting', () => {
    const result = selectDigest(content(), {
      ...choices,
      excludedCategories: ['category'],
    });
    expect(
      Object.values(result).every((group) => group.items.length === 0)
    ).toBe(true);
    expect(result.latest.more).toBe(true);
  });
  it('uses actual votes and explicit favorites only within each selected group', () => {
    expect(
      selectDigest(content(), { ...choices, order: 'popular' }).discussions
        .items[0].id
    ).toBe(uuid(4));
    const recommended = {
      ...choices,
      order: 'recommended' as const,
      favorites: new Set(['discussion:' + uuid(3)]),
    };
    expect(selectDigest(content(), recommended).discussions.items[0].id).toBe(
      uuid(3)
    );
    expect(
      selectDigest(content(), { ...recommended, personalize: false })
        .discussions.items[0].id
    ).toBe(uuid(1));
  });
  it('keeps identity scoped to kind when two content families share a UUID', () => {
    const source = content();
    source.latest.items = [
      {
        kind: 'application',
        id: uuid(1),
        title: 'Application',
        at: 10000,
        target: { kind: 'application', id: uuid(1), slug: 'app' },
        categories: [],
        tags: [],
        engagement: null,
      },
      entry(1),
    ];
    expect(
      selectDigest(source, choices).latest.items.map((item) => item.kind)
    ).toEqual(['application', 'discussion']);
  });
  it('rejects oversized, duplicated, foreign-kind and private boundary fields', () => {
    const source = content();
    for (const invalid of [
      { ...source, hidden: 'private' },
      {
        ...source,
        articles: {
          more: false,
          items: Array(21).fill(source.articles.items[0]),
        },
      },
      {
        ...source,
        applications: {
          more: false,
          items: [source.applications.items[0], source.applications.items[0]],
        },
      },
      {
        ...source,
        discussions: {
          more: false,
          items: [
            {
              ...entry(1),
              kind: 'review',
              target: { ...entry(1).target, kind: 'review' },
            },
          ],
        },
      },
      {
        ...source,
        discussions: { ...source.discussions, through: { key: 'private' } },
      },
    ])
      expect(() => parseDigest(invalid)).toThrow();
  });
  it('validates optional internal kind selection without opening caller tenant or owner scope', () => {
    expect(parseExploreRead({ after: null }, ['discussion'])).toEqual({
      after: null,
      selectedKind: undefined,
    });
    expect(
      parseExploreRead({ after: null, kind: 'discussion' }, ['discussion'])
    ).toEqual({ after: null, selectedKind: 'discussion' });
    for (const input of [
      { after: null, kind: 'application' },
      { after: null, kind: ['discussion'] },
      { after: null, kind: 'discussion', tenantId: 'other' },
      { after: null, kind: undefined },
    ])
      expect(() => parseExploreRead(input, ['discussion'])).toThrow();
  });
});
