import {
  changeProfileBadge,
  parseProfileBadgeAdministration,
  parseProfileBadgeChange,
  parseProfileBadgeEvent,
  parseProfileBadgeSnapshot,
  parseSharedProfileBadges,
  ProfileBadgeConflict,
  type ProfileBadgeSnapshot,
} from './profile-badges';

const profileId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';

describe('erased staff attribution', () => {
  const event = {
    profileId: actorId,
    revision: 1,
    kind: 'verified',
    action: 'award',
    reason: null,
    actorId: null,
    at: 100,
  };
  it('retains the decision without inventing an actor or preserving the private reason', () => {
    expect(parseProfileBadgeEvent(event)).toEqual(event);
  });
  it.each([
    { actorId },
    { reason: 'Private reason' },
    { actorId: '' },
    { actorId: undefined },
  ])('rejects incomplete erasure state: %j', (change) => {
    expect(() => parseProfileBadgeEvent({ ...event, ...change })).toThrow();
  });
});
const empty: ProfileBadgeSnapshot = { profileId, revision: 0, badges: [] };
const award = {
  expectedRevision: 0,
  kind: 'verified' as const,
  action: 'award' as const,
  reason: 'Staff confirmed the profile',
};

describe('staff-awarded profile badge domain', () => {
  it('awards, revokes and re-awards with monotonic independent revisions', () => {
    const one = changeProfileBadge(empty, award, 100);
    const two = changeProfileBadge(
      one,
      { ...award, expectedRevision: 1, kind: 'premium' },
      101
    );
    const three = changeProfileBadge(
      two,
      { ...award, expectedRevision: 2, action: 'revoke' },
      102
    );
    expect(three.badges.find((badge) => badge.kind === 'verified')).toEqual({
      kind: 'verified',
      active: false,
      revision: 3,
      awardedAt: 100,
      updatedAt: 102,
    });
    const four = changeProfileBadge(
      three,
      { ...award, expectedRevision: 3 },
      103
    );
    expect(four.badges.find((badge) => badge.kind === 'verified')).toEqual({
      kind: 'verified',
      active: true,
      revision: 4,
      awardedAt: 103,
      updatedAt: 103,
    });
    expect(
      four.badges.find((badge) => badge.kind === 'premium')?.revision
    ).toBe(2);
    expect(empty.badges).toEqual([]);
    expect(one.badges[0].active).toBe(true);
  });
  it('rejects stale writes, duplicate awards and missing revocations', () => {
    const one = changeProfileBadge(empty, award, 100);
    expect(() => changeProfileBadge(one, award, 101)).toThrow(
      ProfileBadgeConflict
    );
    expect(() =>
      changeProfileBadge(one, { ...award, expectedRevision: 1 }, 101)
    ).toThrow(ProfileBadgeConflict);
    expect(() =>
      changeProfileBadge(empty, { ...award, action: 'revoke' }, 101)
    ).toThrow(ProfileBadgeConflict);
  });
  it('rejects backward timestamps and unsafe revisions', () => {
    const one = changeProfileBadge(empty, award, 100);
    expect(() =>
      changeProfileBadge(
        one,
        { ...award, expectedRevision: 1, action: 'revoke' },
        99
      )
    ).toThrow();
    const maximum = {
      ...one,
      revision: Number.MAX_SAFE_INTEGER,
      badges: [{ ...one.badges[0], revision: Number.MAX_SAFE_INTEGER }],
    };
    expect(() =>
      changeProfileBadge(
        maximum,
        { ...award, expectedRevision: maximum.revision, action: 'revoke' },
        101
      )
    ).toThrow();
  });
  it.each([
    '',
    'ab',
    ' reason',
    'reason ',
    'a\tb',
    'a\u0000b',
    'a\u007fb',
    'a'.repeat(1001),
  ])('requires a bounded meaningful reason: %j', (reason) => {
    expect(() => parseProfileBadgeChange({ ...award, reason })).toThrow();
  });
  it('accepts a multiline reason but rejects extra authority fields', () => {
    expect(
      parseProfileBadgeChange({
        ...award,
        reason: 'Evidence reviewed\nFollow-up complete',
      }).reason
    ).toContain('\n');
    for (const extra of [
      { actorId },
      { tenantId: 'other' },
      { ownerId: profileId },
    ])
      expect(() => parseProfileBadgeChange({ ...award, ...extra })).toThrow();
  });
  it('rejects invalid kinds, timestamp and snapshot inconsistencies', () => {
    const one = changeProfileBadge(empty, award, 100);
    for (const invalid of [
      { ...one, revision: 2 },
      { ...one, badges: [...one.badges, ...one.badges] },
      { ...one, badges: [{ ...one.badges[0], active: 1 }] },
      { ...one, badges: [{ ...one.badges[0], kind: 'admin' }] },
      { ...one, badges: [{ ...one.badges[0], awardedAt: 101 }] },
      { ...one, profileId: 'private-uid' },
    ])
      expect(() => parseProfileBadgeSnapshot(invalid)).toThrow();
  });
  it('public badges exclude staff reasons, actor IDs and hidden values', () => {
    const items = [{ kind: 'verified', awardedAt: 100 }];
    expect(parseSharedProfileBadges({ sharing: 'visible', items })).toEqual({
      sharing: 'visible',
      items,
    });
    expect(parseSharedProfileBadges({ sharing: 'hidden', items: [] })).toEqual({
      sharing: 'hidden',
      items: [],
    });
    for (const invalid of [
      { sharing: 'hidden', items },
      { sharing: 'visible', items: [...items, ...items] },
      { sharing: 'visible', items: [{ ...items[0], reason: award.reason }] },
      { sharing: 'visible', items: [{ ...items[0], actorId }] },
    ])
      expect(() => parseSharedProfileBadges(invalid)).toThrow();
  });
  it('validates staff history scope, order and continuation', () => {
    const one = changeProfileBadge(empty, award, 100);
    const event = {
      profileId,
      actorId,
      revision: 1,
      at: 100,
      kind: award.kind,
      action: award.action,
      reason: award.reason,
    };
    expect(parseProfileBadgeEvent(event)).toEqual(event);
    const value = {
      ...one,
      name: 'Member',
      active: true,
      events: [event],
      after: null,
    };
    expect(parseProfileBadgeAdministration(value)).toEqual(value);
    for (const invalid of [
      { ...value, events: [{ ...event, profileId: actorId }] },
      { ...value, events: [event, event] },
      { ...value, after: 1 },
      { ...value, events: [{ ...event, revision: 2 }] },
      { ...value, name: '' },
    ])
      expect(() => parseProfileBadgeAdministration(invalid)).toThrow();
  });
});
