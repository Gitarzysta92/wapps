import {
  parseProfileDiscussionsPage,
  profileDiscussionsCursor,
} from './profile-discussions';
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = {
  id: id(1),
  parentKind: 'application',
  parentId: id(2),
  parentSlug: 'public-app',
  title: 'Public topic',
  createdAt: 10,
  replyCount: 2,
  participation: 'participant',
};
const page = { sharing: 'visible', items: [item], after: null };
describe('shared profile discussion contract', () => {
  it('supports current application topics, article threads and hidden/empty pages', () => {
    expect(parseProfileDiscussionsPage(page)).toEqual(page);
    expect(
      parseProfileDiscussionsPage({
        ...page,
        items: [{ ...item, parentKind: 'article' }],
      }).items[0].parentKind
    ).toBe('article');
    expect(
      parseProfileDiscussionsPage({ sharing: 'hidden', items: [], after: null })
        .sharing
    ).toBe('hidden');
    expect(
      parseProfileDiscussionsPage({
        ...page,
        items: [],
        after: 'v1.' + 'a'.repeat(100),
      }).after
    ).not.toBeNull();
  });
  it.each([
    { ...page, ownerIdentityId: 'private' },
    { ...page, sharing: 'hidden' },
    { ...page, items: [{ ...item, ownerIdentityId: 'private' }] },
    { ...page, items: [{ ...item, title: 'hidden\nvalue' }] },
    { ...page, items: [{ ...item, parentSlug: '../private' }] },
    { ...page, items: [{ ...item, replyCount: 2000 }] },
    { ...page, items: [item, item] },
    { ...page, items: [item, { ...item, id: id(3), createdAt: 11 }] },
    { ...page, items: Array(11).fill(item) },
  ])(
    'rejects private fields, invalid metadata and broken ordering: %j',
    (value) => {
      expect(() => parseProfileDiscussionsPage(value)).toThrow();
    }
  );
  it.each([undefined, '', id(1), 'v1.x', ['token'], 'v1.' + 'a'.repeat(197)])(
    'rejects malformed continuation: %j',
    (value) => {
      expect(() => profileDiscussionsCursor(value)).toThrow();
    }
  );
});
