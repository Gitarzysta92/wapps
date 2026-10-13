import { selectExplorePage, type ExploreSelection } from './explore-selection';
import type { ExploreItem } from './explore';
const options: ExploreSelection = {
  showMatureContent: true,
  order: 'recent',
  personalize: false,
  preferredCategories: [],
  excludedCategories: [],
  preferredTags: [],
  favorites: new Set(),
};
const items: ExploreItem[] = [1, 2, 3].map((n) => ({
  kind: 'discussion',
  id: String(n),
  at: 100 - n,
  title: 'Topic',
  target: {
    kind: 'discussion',
    id: String(n),
    applicationId: 'app-' + n,
    applicationSlug: 'app',
  },
  categories: ['category-' + n],
  tags: ['tag-' + n],
  engagement: n,
}));
describe('Explore saved content choices', () => {
  it('hides mature and unclassified items before every ranking, including saved favorites', () => {
    const source: ExploreItem[] = [
      { ...items[0], classification: 'general' },
      { ...items[1], classification: 'mature' },
      items[2],
    ];
    for (const order of ['recent', 'popular', 'recommended'] as const) {
      expect(
        selectExplorePage(source, {
          ...options,
          order,
          personalize: true,
          showMatureContent: false,
          favorites: new Set(['discussion:2', 'discussion:3']),
        }).map((item) => item.id)
      ).toEqual(['1']);
      expect(selectExplorePage(source, { ...options, order })).toHaveLength(3);
    }
    expect(source).toHaveLength(3);
  });
  it('always excludes selected categories and never mutates the canonical page', () => {
    expect(
      selectExplorePage(items, {
        ...options,
        excludedCategories: ['category-2'],
      }).map((i) => i.id)
    ).toEqual(['1', '3']);
    expect(items).toHaveLength(3);
  });
  it('uses actual engagement for popularity and chronology for ties', () => {
    expect(
      selectExplorePage(items, { ...options, order: 'popular' }).map(
        (i) => i.id
      )
    ).toEqual(['3', '2', '1']);
    expect(
      selectExplorePage(
        items.map((i) => ({ ...i, engagement: null })),
        { ...options, order: 'popular' }
      ).map((i) => i.id)
    ).toEqual(['1', '2', '3']);
  });
  it('uses explicit favorites before preferred facets only with personalization enabled', () => {
    const personal = {
      ...options,
      order: 'recommended' as const,
      personalize: true,
      favorites: new Set(['application:app-2']),
      preferredTags: ['tag-3'],
    };
    expect(selectExplorePage(items, personal).map((i) => i.id)).toEqual([
      '2',
      '3',
      '1',
    ]);
    expect(
      selectExplorePage(items, { ...personal, personalize: false }).map(
        (i) => i.id
      )
    ).toEqual(['1', '2', '3']);
  });
  it('does not let a favorite bypass a category exclusion', () => {
    expect(
      selectExplorePage(items, {
        ...options,
        order: 'recommended',
        personalize: true,
        favorites: new Set(['discussion:1']),
        excludedCategories: ['category-1'],
      }).map((i) => i.id)
    ).toEqual(['2', '3']);
  });
});
