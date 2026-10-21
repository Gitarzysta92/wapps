import { ProfileBadgeConflict } from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import { PublicProfileNotFound } from './ports/public-profile.port';
import { ProfileBadgesService } from './profile-badges.service';

const id = '00000000-0000-4000-8000-000000000001';
const ctx = {
  identityId: 'StaffUid',
  timestamp: 1,
  subject: { roles: ['identity:badge-manager'] },
};
const command = {
  expectedRevision: 0,
  kind: 'verified',
  action: 'award',
  reason: 'Evidence reviewed',
};
const shared = {
  sharing: 'visible',
  items: [{ kind: 'verified', awardedAt: 100 }],
};
function fixture() {
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  const audience = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const snapshot = {
    profile: { id },
    facts: { badgesShared: true },
    stamp: 'stamp',
  };
  const profiles = {
    inspect: jest.fn().mockResolvedValue(snapshot),
    confirm: jest.fn().mockResolvedValue(true),
    avatar: jest.fn(),
    directory: jest.fn(),
    followers: jest.fn(),
    following: jest.fn(),
    prepareFollow: jest.fn(),
    changeFollow: jest.fn(),
  };
  const store = {
    assertStaffIdentity: jest.fn(),
    administer: jest.fn().mockResolvedValue({ revision: 0 }),
    change: jest.fn().mockResolvedValue({ revision: 1 }),
    own: jest.fn().mockResolvedValue(shared),
    shared: jest.fn().mockResolvedValue(shared),
  };
  const authority = new (class extends AuthorityValidationService {})({
    evaluate,
  });
  return {
    evaluate,
    audience,
    snapshot,
    profiles,
    store,
    service: new ProfileBadgesService(authority, audience, profiles, store),
  };
}
describe('profile badge application authorization', () => {
  it('checks staff capabilities against policy and canonical actor lifecycle', async () => {
    const f = fixture();
    expect(await f.service.capabilities(ctx)).toEqual(
      ok({ kinds: ['verified', 'premium'] })
    );
    expect(f.store.assertStaffIdentity).toHaveBeenCalledWith('StaffUid');
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.profile-badges.read',
        resource: { type: 'profile-badges', id: 'StaffUid' },
        subject: ctx.subject,
      })
    );
  });
  it('authorizes before validation and storage, preserving command identity', async () => {
    const f = fixture();
    expect(await f.service.change(id, command, 'key', ctx)).toEqual(
      ok({ revision: 1 })
    );
    expect(f.store.change).toHaveBeenCalledWith('StaffUid', id, command, 'key');
    expect(f.evaluate.mock.invocationCallOrder[0]).toBeLessThan(
      f.store.change.mock.invocationCallOrder[0]
    );
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.profile-badges.update',
        resource: { type: 'profile-badges', id },
      })
    );
  });
  it.each([false, 'true', null])(
    'rejects non-true policy: %j',
    async (value) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(ok(value));
      expect(await f.service.change(id, null, '', ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(await f.service.administer(id, null, ctx)).toEqual(
        err(expect.any(CanonicalIdentityAccessDenied))
      );
      expect(f.store.change).not.toHaveBeenCalled();
      expect(f.store.administer).not.toHaveBeenCalled();
    }
  );
  it('fails closed on outages and inactive actors', async () => {
    const f = fixture();
    f.evaluate.mockResolvedValue(err(new Error('policy down')));
    expect(await f.service.capabilities(ctx)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    expect(f.store.assertStaffIdentity).not.toHaveBeenCalled();
    f.evaluate.mockResolvedValue(ok(true));
    f.store.assertStaffIdentity.mockRejectedValue(
      new CanonicalIdentityAccessDenied('inactive')
    );
    expect(await f.service.capabilities(ctx)).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
  });
  it('rejects injected fields, missing keys, private IDs and malformed history', async () => {
    const f = fixture();
    for (const value of [
      { ...command, actorId: id },
      { ...command, reason: '' },
      { ...command, expectedRevision: -1 },
    ])
      expect(await f.service.change(id, value, 'key', ctx)).toEqual(
        err(expect.any(CanonicalIdentityInputError))
      );
    expect(await f.service.change(id, command, '', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(await f.service.administer('private-uid', null, ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(await f.service.administer(id, '1', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(f.store.change).not.toHaveBeenCalled();
    expect(f.store.administer).not.toHaveBeenCalled();
  });
  it('exposes conflicts without automatic new-intent retries', async () => {
    const f = fixture();
    f.store.change.mockRejectedValue(new ProfileBadgeConflict('stale'));
    expect(await f.service.change(id, command, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityConflict))
    );
    expect(f.store.change).toHaveBeenCalledTimes(1);
  });
  it('reads owner badges using self policy independently of public sharing', async () => {
    const f = fixture();
    expect(await f.service.own(ctx)).toEqual(ok(shared));
    expect(f.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'identity.profile.read',
        resource: { type: 'user', id: 'StaffUid' },
      })
    );
    expect(f.audience.evaluate).not.toHaveBeenCalled();
  });
  it('requires audience before badge sharing and reconfirms after the read', async () => {
    const f = fixture();
    expect(await f.service.shared(id, null)).toEqual(ok(shared));
    expect(f.audience.evaluate.mock.calls).toEqual([
      ['read', f.snapshot.facts],
      ['read-badges', f.snapshot.facts],
    ]);
    expect(f.store.shared).toHaveBeenCalledWith(f.snapshot, null);
    expect(f.store.shared.mock.invocationCallOrder[0]).toBeLessThan(
      f.profiles.confirm.mock.invocationCallOrder[0]
    );
  });
  it('conceals inaccessible profiles without loading badges', async () => {
    const f = fixture();
    f.audience.evaluate.mockResolvedValue(ok(false));
    expect(await f.service.shared(id, null)).toEqual(
      err(expect.any(PublicProfileNotFound))
    );
    expect(f.store.shared).not.toHaveBeenCalled();
  });
  it('returns hidden sharing without accessing badge state', async () => {
    const f = fixture();
    f.audience.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(ok(false));
    expect(await f.service.shared(id, 'OwnerUid')).toEqual(
      ok({ sharing: 'hidden', items: [] })
    );
    expect(f.store.shared).not.toHaveBeenCalled();
    expect(f.profiles.confirm).toHaveBeenCalled();
  });
  it('rejects in-flight privacy changes and policy outages', async () => {
    const f = fixture();
    f.profiles.confirm.mockResolvedValue(false);
    expect(await f.service.shared(id, null)).toEqual(
      err(expect.any(PublicProfileNotFound))
    );
    f.audience.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(err(new Error('down')));
    expect(await f.service.shared(id, null)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    expect(f.store.shared).toHaveBeenCalledTimes(1);
  });
});
