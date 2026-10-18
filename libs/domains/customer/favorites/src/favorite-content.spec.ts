import { parseFavoriteContent } from './favorite-content';
const id = '10000000-0000-4000-8000-000000000001';
const item = {
  kind: 'applications',
  id,
  name: 'Current application',
  slug: 'current',
  status: 'available',
  classification: 'general',
};
const response = { identityId: 'Alice', revision: 2, items: [item] };
describe('composed private favorite content contract', () => {
  it('retains canonical links, classification and owner revision', () => {
    expect(
      parseFavoriteContent(response, [{ kind: 'applications', id }])
    ).toEqual(response);
  });
  it('keeps unavailable references without copied metadata', () => {
    const value = {
      ...response,
      items: [
        {
          kind: 'articles',
          id,
          name: 'Unavailable article',
          slug: null,
          status: 'unavailable',
        },
      ],
    };
    expect(parseFavoriteContent(value)).toEqual(value);
  });
  it.each([
    { ...item, id: 'slug' },
    { ...item, classification: 'safe' },
    { ...item, status: ['available'] },
    { ...item, image: 'javascript:alert(1)' },
    { ...item, appSlug: 'unexpected' },
    { ...item, extra: true },
    { ...item, kind: 'suites' },
    { ...item, kind: 'discussions', slug: id },
    { ...item, status: 'unavailable', slug: null },
  ])('rejects unsafe or inconsistent metadata %#', (value) => {
    expect(() =>
      parseFavoriteContent({ ...response, items: [value] })
    ).toThrow();
  });
  it('rejects duplicate, oversized and changed reference sets', () => {
    expect(() =>
      parseFavoriteContent({ ...response, items: [item, item] })
    ).toThrow();
    expect(() =>
      parseFavoriteContent({ ...response, items: Array(201).fill(item) })
    ).toThrow();
    expect(() =>
      parseFavoriteContent(response, [{ kind: 'suites', id }])
    ).toThrow();
    expect(() => parseFavoriteContent(response, [])).toThrow();
  });
});
