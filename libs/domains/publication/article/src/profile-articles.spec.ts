import {
  parseProfileArticlesPage,
  parseProfileArticlesQuery,
  profileArticlesPage,
} from './profile-articles';

const item = (index: number) => ({
  id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  title: 'Public title',
  excerpt: 'Reviewed excerpt',
  slug: 'published-article',
  publishedAt: 100,
});
describe('public profile articles contract', () => {
  it('pages only ordered public summaries and continues from a returned UUID', () => {
    const page = profileArticlesPage(
      Array.from({ length: 21 }, (_, index) => item(index)),
      null
    );
    expect(page.items).toHaveLength(20);
    expect(page.after).toBe(item(19).id);
    expect(profileArticlesPage([item(20)], page.after)).toEqual({
      sharing: 'visible',
      items: [item(20)],
      after: null,
    });
  });
  it('retains continuation after classification removes some or all scanned items', () => {
    for (const items of [[], [{ ...item(1), classification: 'general' }]])
      expect(
        parseProfileArticlesPage({
          sharing: 'visible',
          items,
          after: item(2).id,
        }).after
      ).toBe(item(2).id);
  });
  it('distinguishes hidden from an empty shared collection', () => {
    for (const sharing of ['hidden', 'visible'])
      expect(
        parseProfileArticlesPage({ sharing, items: [], after: null }).sharing
      ).toBe(sharing);
  });
  it.each([
    { sharing: 'hidden', items: [item(1)], after: null },
    {
      sharing: 'visible',
      items: [{ ...item(1), ownerIdentityId: 'PrivateUid' }],
      after: null,
    },
    {
      sharing: 'visible',
      items: [{ ...item(1), sections: [] }],
      after: null,
    },
    { sharing: 'visible', items: [item(1), item(1)], after: null },
    { sharing: 'visible', items: [item(2), item(1)], after: null },
    { sharing: 'visible', items: [item(2)], after: item(1).id },
    {
      sharing: 'visible',
      items: [{ ...item(1), title: 'x'.repeat(161) }],
      after: null,
    },
  ])(
    'rejects private fields, invalid text/order and malformed continuations: %j',
    (value) => {
      expect(() => parseProfileArticlesPage(value)).toThrow();
    }
  );
  it.each([
    { slug: '../private' },
    { publishedAt: -1 },
    { publishedAt: '100' },
    { title: '\ud800' },
    { excerpt: 'x'.repeat(1001) },
  ])('rejects malformed article summary %j', (invalid) => {
    expect(() =>
      parseProfileArticlesPage({
        sharing: 'visible',
        items: [{ ...item(1), ...invalid }],
        after: null,
      })
    ).toThrow();
  });
  it('rejects unknown scope and cursor injection before listing', () => {
    for (const query of [
      { ownerIdentityId: 'PrivateUid' },
      { after: [item(1).id] },
      { after: '' },
      { after: null },
      { after: 'a-slug' },
    ])
      expect(() => parseProfileArticlesQuery(query)).toThrow();
    expect(parseProfileArticlesQuery({})).toEqual({ after: null });
    expect(parseProfileArticlesQuery({ after: item(1).id })).toEqual({
      after: item(1).id,
    });
    expect(() => profileArticlesPage([item(1)], item(1).id)).toThrow();
  });
});
