import {
  parsePublicProfileFavoritesPage,
  parsePublicFavoritesCursor,
  publicProfileFavoritesPage,
} from './public-profile-favorites';

const id = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const item = (value: number) => ({
  kind: 'applications' as const,
  id: id(value),
  title: `App ${value}`,
  slug: `app-${value}`,
  applicationSlug: null,
});

describe('public profile favorites contract', () => {
  it('pages only resolved public content without revealing an unavailable target in its cursor', () => {
    const targets = Array.from({ length: 25 }, (_, i) => ({
      kind: 'applications' as const,
      id: id(i + 1),
    }));
    const available = targets.slice(1).map((_, i) => item(i + 2));
    const page = publicProfileFavoritesPage(available.reverse(), targets, null);
    expect(page.items).toHaveLength(20);
    expect(page.items[0].id).toBe(id(2));
    expect(page.after).toBe(`applications:${id(21)}`);
    expect(parsePublicProfileFavoritesPage(page)).toEqual(page);
    expect(
      publicProfileFavoritesPage(available, targets, page.after).items
    ).toHaveLength(4);
  });
  it('accepts a hidden empty section and rejects hidden payloads or continuation', () => {
    expect(
      parsePublicProfileFavoritesPage({
        sharing: 'hidden',
        items: [],
        after: null,
      }).sharing
    ).toBe('hidden');
    expect(() =>
      parsePublicProfileFavoritesPage({
        sharing: 'hidden',
        items: [item(1)],
        after: null,
      })
    ).toThrow();
    expect(() =>
      parsePublicProfileFavoritesPage({
        sharing: 'hidden',
        items: [],
        after: `applications:${id(1)}`,
      })
    ).toThrow();
  });
  it('rejects foreign and duplicate selections and excess saved relations', () => {
    const target = { kind: 'applications' as const, id: id(1) };
    expect(() =>
      publicProfileFavoritesPage([item(2)], [target], null)
    ).toThrow();
    expect(() =>
      publicProfileFavoritesPage([item(1), item(1)], [target, target], null)
    ).toThrow();
    expect(() =>
      publicProfileFavoritesPage([], Array(201).fill(target), null)
    ).toThrow();
  });
  it.each([
    'uid:secret',
    `applications:${id(1)}:extra`,
    {},
    '',
    'applications:BAD',
  ])('rejects malformed cursors %j', (value) =>
    expect(() => parsePublicFavoritesCursor(value)).toThrow()
  );
  it('rejects unbounded titles, unsafe route values and injected private fields', () => {
    for (const patch of [
      { title: 'x'.repeat(256) },
      { slug: '//other.test' },
      { title: 'private\u0000' },
      { identityId: 'credential-uid' },
      { applicationSlug: 'unexpected-parent' },
    ])
      expect(() =>
        parsePublicProfileFavoritesPage({
          sharing: 'visible',
          items: [{ ...item(1), ...patch }],
          after: null,
        })
      ).toThrow();
  });
  it('requires discussion parents and canonical discussion/suite route IDs', () => {
    const discussion = {
      ...item(1),
      kind: 'discussions',
      slug: id(1),
      applicationSlug: 'parent-app',
    };
    expect(
      parsePublicProfileFavoritesPage({
        sharing: 'visible',
        items: [discussion],
        after: null,
      }).items[0]
    ).toEqual(discussion);
    expect(() =>
      parsePublicProfileFavoritesPage({
        sharing: 'visible',
        items: [{ ...discussion, applicationSlug: null }],
        after: null,
      })
    ).toThrow();
    expect(() =>
      parsePublicProfileFavoritesPage({
        sharing: 'visible',
        items: [{ ...discussion, slug: id(2) }],
        after: null,
      })
    ).toThrow();
  });
});
