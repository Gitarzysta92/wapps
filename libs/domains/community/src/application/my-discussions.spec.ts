import { myDiscussionCursor, parseMyDiscussionPage } from './my-discussions';

const id = '10000000-0000-4000-8000-000000000001';
const item = {
  id,
  applicationId: id,
  title: 'Topic',
  createdAt: 1,
  replyCount: 0,
  participation: 'author',
};

describe('account discussion contract', () => {
  it('allows empty filtered pages with a continuation', () => {
    expect(parseMyDiscussionPage({ items: [], next: `1.${id}` })).toEqual({
      items: [],
      next: `1.${id}`,
    });
    expect(parseMyDiscussionPage({ items: [item], next: null }).items).toEqual([
      item,
    ]);
  });
  it.each([
    '',
    `-1.${id}`,
    `01.${id}`,
    `9007199254740992.${id}`,
    `1.${id}.x`,
    ['1'],
  ])('rejects invalid cursor %p', (cursor) => {
    expect(() => myDiscussionCursor(cursor)).toThrow();
  });
  it('rejects uppercase UUIDs and private fields', () => {
    expect(() =>
      myDiscussionCursor('1.A0000000-0000-4000-8000-000000000001')
    ).toThrow();
    expect(() =>
      parseMyDiscussionPage({
        items: [{ ...item, ownerIdentityId: 'private' }],
        next: null,
      })
    ).toThrow();
  });
  it.each([
    { title: '' },
    { title: ' leading' },
    { title: 'line\nbreak' },
    { createdAt: -1 },
    { replyCount: 2000 },
    { participation: 'admin' },
    { applicationId: 'slug' },
  ])('rejects malformed entries %p', (change) => {
    expect(() =>
      parseMyDiscussionPage({ items: [{ ...item, ...change }], next: null })
    ).toThrow();
  });
  it('rejects duplicate and oversized pages and missing continuation', () => {
    expect(() =>
      parseMyDiscussionPage({ items: [item, item], next: null })
    ).toThrow();
    expect(() =>
      parseMyDiscussionPage({ items: Array(11).fill(item), next: null })
    ).toThrow();
    expect(() => parseMyDiscussionPage({ items: [] })).toThrow();
  });
});
