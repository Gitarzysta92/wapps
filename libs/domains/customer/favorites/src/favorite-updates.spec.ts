import {
  favoriteUpdateCursor,
  parseFavoriteUpdatePage,
  parseFavoriteUpdateState,
  parseFavoriteUpdateVersion,
} from './favorite-updates';

const id = '00000000-0000-4000-8000-000000000001';
const state = {
  target: { kind: 'applications', id },
  version: 2,
  at: 100,
  content: {
    title: 'Application',
    destination: { kind: 'applications', slug: 'application' },
  },
};
describe('favorite update contracts', () => {
  it('accepts current public content and an explicit unavailable target without inventing metadata', () => {
    expect(parseFavoriteUpdateState(state)).toEqual(state);
    expect(
      parseFavoriteUpdateState({ ...state, content: null }).content
    ).toBeNull();
    expect(parseFavoriteUpdateVersion({ version: 0, at: 0 })).toEqual({
      version: 0,
      at: 0,
    });
  });
  it.each([
    { version: -1, at: 100 },
    { version: 0, at: 1 },
    { version: 1, at: 0 },
    { version: 1.5, at: 100 },
    { version: '1', at: 100 },
    { version: 1, at: Infinity },
    { version: 1, at: 8_640_000_000_000_001 },
    { version: 1, at: 100, extra: true },
  ])('rejects invalid versions %p', (value) =>
    expect(() => parseFavoriteUpdateVersion(value)).toThrow()
  );
  it.each([
    { ...state, identityId: 'other' },
    { ...state, content: {} },
    { ...state, target: { kind: 'release', id } },
    {
      ...state,
      content: {
        title: 'Private',
        destination: { kind: 'articles', slug: 'private' },
      },
    },
    {
      ...state,
      content: {
        title: 'Public',
        destination: { kind: 'applications', slug: '../private' },
      },
    },
    {
      ...state,
      content: {
        title: '',
        destination: { kind: 'applications', slug: 'public' },
      },
    },
  ])('rejects ambiguous or unsafe content %p', (value) =>
    expect(() => parseFavoriteUpdateState(value)).toThrow()
  );
  it('accepts suite and exact application/article conversation destinations', () => {
    expect(
      parseFavoriteUpdateState({
        ...state,
        target: { kind: 'suites', id },
        content: { title: 'Suite', destination: { kind: 'suites' } },
      }).target.kind
    ).toBe('suites');
    for (const parentKind of ['application', 'article'])
      expect(
        parseFavoriteUpdateState({
          ...state,
          target: { kind: 'discussions', id },
          content: {
            title: 'Conversation',
            destination: { kind: 'discussions', parentKind, slug: 'parent' },
          },
        }).target.kind
      ).toBe('discussions');
  });
  it('bounds inbox rows, duplicate IDs, timestamps and disabled responses', () => {
    const item = {
      id,
      target: state.target,
      ...state.content,
      at: 100,
      readAt: null,
    };
    expect(
      parseFavoriteUpdatePage({ enabled: true, items: [item], next: null })
        .items
    ).toEqual([item]);
    for (const value of [
      { enabled: true, items: [item, item], next: null },
      { enabled: true, items: Array(11).fill(item), next: null },
      { enabled: false, items: [item], next: null },
      { enabled: true, items: [{ ...item, readAt: 99 }], next: null },
      { enabled: true, items: [], next: undefined },
    ])
      expect(() => parseFavoriteUpdatePage(value)).toThrow();
  });
  it('requires a canonical bounded cursor', () => {
    expect(favoriteUpdateCursor(`100.${id}`)).toEqual({ at: 100, id });
    for (const value of [
      `0100.${id}`,
      `-1.${id}`,
      `Infinity.${id}`,
      '0.invalid',
      {},
    ])
      expect(() => favoriteUpdateCursor(value)).toThrow();
  });
});
