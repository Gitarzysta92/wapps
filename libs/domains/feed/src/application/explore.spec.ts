import {
  compareExplore,
  exploreCursor,
  exploreItemPosition,
  explorePosition,
  mergeExplore,
  parseExploreBatch,
  parseExploreItem,
  parseExplorePage,
  type ExploreItem,
} from './explore';

const id = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function item(n: number, at = 1000 - n): ExploreItem {
  return {
    kind: 'application',
    id: id(n),
    at,
    title: `App ${n}`,
    target: { kind: 'application', id: id(n), slug: `app-${n}` },
    categories: [],
    tags: [],
    engagement: null,
  };
}
describe('Explore transport and merge', () => {
  it('preserves reviewed classification and keeps legacy missing values unclassified', () => {
    expect(parseExploreItem(item(1))).not.toHaveProperty('classification');
    for (const classification of ['general', 'mature'])
      expect(parseExploreItem({ ...item(1), classification })).toMatchObject({
        classification,
      });
    for (const classification of [null, '', 'General', 'safe', false, 1])
      expect(() => parseExploreItem({ ...item(1), classification })).toThrow();
  });
  it('merges chronological pages and retains the next source boundary', () => {
    const merged = mergeExplore(
      [
        { items: [item(1), item(3)], through: exploreItemPosition(item(3)) },
        { items: [item(2), item(4)], through: null },
      ],
      null
    );
    expect(merged.items.map((i) => i.id)).toEqual([id(1), id(2), id(3)]);
    expect(merged.through).toEqual(exploreItemPosition(item(3)));
  });
  it('advances across a completely hidden page without skipping the other source', () => {
    expect(
      mergeExplore(
        [
          { items: [], through: exploreItemPosition(item(3)) },
          { items: [item(2), item(4)], through: null },
        ],
        null
      )
    ).toEqual({ items: [item(2)], through: exploreItemPosition(item(3)) });
  });
  it('caps the merge at ten and continues from the last selected item', () => {
    const merged = mergeExplore(
      [
        {
          items: Array.from({ length: 10 }, (_, n) => item(n + 1)),
          through: null,
        },
        { items: [item(11)], through: null },
      ],
      null
    );
    expect(merged.items).toHaveLength(10);
    expect(merged.through).toEqual(exploreItemPosition(item(10)));
  });
  it('uses binary identity ties, and accepts an empty terminal page', () => {
    expect(
      compareExplore(
        exploreItemPosition(item(1, 1)),
        exploreItemPosition(item(2, 1))
      )
    ).toBeLessThan(0);
    expect(parseExplorePage({ items: [], after: null })).toEqual({
      items: [],
      after: null,
    });
  });
  it.each([
    { ...item(1), id: 'owner-credential' },
    { ...item(1), extra: true },
    { ...item(1), title: '<title>\nsecret' },
    { ...item(1), at: NaN },
    { ...item(1), target: { kind: 'application', id: id(2), slug: 'app' } },
    {
      ...item(1),
      target: { kind: 'application', id: id(1), slug: '//elsewhere' },
    },
    { ...item(1), tags: ['duplicate', 'duplicate'] },
    { ...item(1), engagement: 3 },
  ])('rejects malformed or fabricated data %#', (value) =>
    expect(() => parseExploreItem(value)).toThrow()
  );
  it('rejects invalid order, duplicates, retrograde source results and scan bounds', () => {
    expect(() =>
      parseExploreBatch({ items: [item(2), item(1)], through: null })
    ).toThrow();
    expect(() =>
      parseExploreBatch({
        items: [item(3)],
        through: exploreItemPosition(item(1)),
      })
    ).toThrow();
    expect(() =>
      mergeExplore(
        [
          { items: [item(1)], through: null },
          { items: [item(1)], through: null },
        ],
        null
      )
    ).toThrow();
    expect(() =>
      mergeExplore(
        [
          { items: [item(1)], through: null },
          { items: [], through: null },
        ],
        exploreItemPosition(item(1))
      )
    ).toThrow();
    expect(() =>
      parseExploreBatch({
        items: Array.from({ length: 11 }, (_, n) => item(n + 1)),
        through: null,
      })
    ).toThrow();
  });
  it('accepts only opaque versioned public cursors and typed internal positions', () => {
    expect(exploreCursor(null)).toBeNull();
    expect(() => exploreCursor('1000.application:' + id(1))).toThrow();
    expect(() => explorePosition({ at: 1, key: 'private:' + id(1) })).toThrow();
    expect(() => parseExplorePage({ items: [], after: undefined })).toThrow();
  });
});
