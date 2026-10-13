import {
  activityIsShared, activityPosition, compareActivity, mergeProfileActivity,
  parseProfileActivity, parseProfileActivityBatch, parseProfileActivityPage,
  profileActivityRequest, type ProfileActivity, type ProfileActivityPosition,
} from './profile-activity';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const activity = (value: number, at = 1000 - value): ProfileActivity => ({ kind: 'article', id: id(value), at, title: 'Published article', target: { kind: 'article', id: id(value), slug: 'published-article' } });
describe('profile activity contract and chronological merge', () => {
  it('merges uneven streams with hidden candidates without omissions or duplicates', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const all = Array.from({ length: 95 }, (_, i) => activity(i + 1, 1000 - Math.floor(i / 4)));
      const sources = [0, 1, 2].map((source) => all.filter((_, i) => (i * seed + i) % 3 === source));
      const hidden = (item: ProfileActivity) => Number(item.id.slice(-5)) % (seed + 1) === 0;
      let after: ProfileActivityPosition | null = null;
      const actual: ProfileActivity[] = [];
      for (let page = 0; page < 100; page++) {
        const cursor = after;
        const batches = sources.map((source) => {
          const remaining = source.filter((item) => !cursor || compareActivity(cursor, activityPosition(item)) < 0);
          const scanned = remaining.slice(0, 10);
          return { items: scanned.filter((item) => !hidden(item)), through: remaining.length > 10 ? activityPosition(scanned[9]) : null };
        });
        const merged = mergeProfileActivity(batches, after);
        actual.push(...merged.items);
        after = merged.through;
        if (!after) break;
      }
      expect(after).toBeNull();
      expect(actual).toEqual(all.filter((item) => !hidden(item)));
    }
  });
  it('preserves continuation through a fully hidden page', () => {
    const through = activityPosition(activity(10));
    expect(mergeProfileActivity([{ items: [], through }, { items: [activity(20)], through: null }], null)).toEqual({ items: [], through });
  });
  it('rejects nonprogressing, duplicated, unordered and out-of-window source data', () => {
    const a = activity(1), b = activity(2);
    expect(() => mergeProfileActivity([{ items: [a], through: null }], activityPosition(a))).toThrow();
    expect(() => mergeProfileActivity([{ items: [a], through: null }, { items: [a], through: null }], null)).toThrow();
    expect(() => parseProfileActivityBatch({ items: [b, a], through: null })).toThrow();
    expect(() => parseProfileActivityBatch({ items: [b], through: activityPosition(a) })).toThrow();
  });
  it.each([
    { title: 'private\ntext' }, { at: 0 }, { at: Number.MAX_SAFE_INTEGER },
    { ownerId: 'PrivateUid' }, { kind: 'login' }, { target: { kind: 'article', id: id(2), slug: 'other' } },
    { target: { kind: 'article', id: id(1), slug: 'https://outside.example' } },
  ])('rejects unsafe or unrelated activity metadata %j', (change) => expect(() => parseProfileActivity({ ...activity(1), ...change })).toThrow());
  it('supports a reply identity distinct from its public root', () => {
    expect(parseProfileActivity({ ...activity(1), kind: 'reply', target: { kind: 'discussion', id: id(2), applicationSlug: 'public-app' } }).target.id).toBe(id(2));
  });
  it('intersects history sharing with category sharing', () => {
    const item = parseProfileActivity({ ...activity(1), kind: 'favorite-suite', target: { kind: 'suite', id: id(1) } });
    expect(activityIsShared(item, { favorites: true, suites: false, discussions: true })).toBe(false);
    expect(activityIsShared(item, { favorites: false, suites: true, discussions: true })).toBe(false);
  });
  it('rejects public hidden payloads, readable cursors and malformed internal scopes', () => {
    expect(() => parseProfileActivityPage({ sharing: 'hidden', items: [activity(1)], after: null })).toThrow();
    expect(() => parseProfileActivityPage({ sharing: 'visible', items: [], after: `${100}.${id(1)}` })).toThrow();
    expect(() => profileActivityRequest({ ownerIdentityId: 'Owner', after: null, sharing: { suites: 'true', favorites: false, discussions: false } })).toThrow();
  });
});
