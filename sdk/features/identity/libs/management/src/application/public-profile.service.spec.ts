import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import { PublicProfileService } from './public-profile.service';
import {
  PublicProfileNotFound,
  type PublicProfileSnapshot,
} from './ports/public-profile.port';

const ownerId = '00000000-0000-4000-8000-000000000001';
const requesterId = '00000000-0000-4000-8000-000000000002';
const ctx = {
  identityId: 'requester',
  timestamp: 1,
  subject: { roles: ['admin'] },
};
const follow = { ownerId, requesterId, revision: 0, status: 'none' as const };
const input = {
  ownerId,
  requesterId,
  expectedRevision: 0,
  action: 'request' as const,
};
const snapshot: PublicProfileSnapshot = {
  profile: {
    id: ownerId,
    name: 'Private name',
    bio: null,
    location: null,
    socialLinks: {},
    avatarId: null,
    registeredAt: 1,
  },
  facts: {
    ownerId,
    viewerId: requesterId,
    ownerActive: true,
    viewerActive: true,
    viewerRegistered: true,
    visibility: 'followers',
    approved: false,
  },
  follow,
  stamp: 'canonical-revision-stamp',
};

function fixture() {
  const validate = jest.fn().mockResolvedValue(ok(true));
  const authority = new (class extends AuthorityValidationService {})({
    evaluate: validate,
  });
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const store = {
    inspect: jest.fn().mockResolvedValue(snapshot),
    confirm: jest.fn().mockResolvedValue(snapshot),
    avatar: jest.fn(),
    directory: jest
      .fn()
      .mockResolvedValue({ snapshots: [snapshot], after: null }),
    followers: jest.fn(),
    following: jest.fn(),
    prepareFollow: jest.fn().mockResolvedValue({ snapshot }),
    changeFollow: jest
      .fn()
      .mockResolvedValue({ ...follow, revision: 1, status: 'pending' }),
  };
  return {
    validate,
    policy,
    store,
    service: new PublicProfileService(authority, policy, store),
  };
}

describe('canonical profile audience boundary', () => {
  it('authorizes canonical facts and rechecks them after asynchronous policy evaluation', async () => {
    const f = fixture();
    expect((await f.service.read(ownerId, 'requester')).ok).toBe(true);
    expect(f.policy.evaluate).toHaveBeenCalledWith('read', snapshot.facts);
    expect(f.store.confirm).toHaveBeenCalledWith(snapshot, 'requester');
    expect(f.store.confirm.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.policy.evaluate.mock.invocationCallOrder[0]
    );
  });
  it('returns no personal payload for a requestable follower profile', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValueOnce(ok(false));
    expect(await f.service.read(ownerId, 'requester')).toEqual(
      ok({ access: 'followers', profile: null, follow, isOwner: false })
    );
  });
  it.each([false, 'true', null])(
    'denies nontrue decisions even for administrative viewers: %j',
    async (decision) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(ok(decision));
      expect(await f.service.read(ownerId, ctx.identityId)).toEqual(
        err(expect.any(PublicProfileNotFound))
      );
      expect(f.store.confirm).not.toHaveBeenCalled();
    }
  );
  it('withholds results when privacy, viewer, or relationship authority changes during policy I/O', async () => {
    const f = fixture();
    f.store.confirm.mockResolvedValue(null);
    expect(await f.service.read(ownerId, 'requester')).toEqual(
      err(expect.any(PublicProfileNotFound))
    );
    expect(await f.service.directory(null, null)).toEqual(
      ok({ profiles: [], after: null })
    );
  });
  it('reports a policy outage without falling back to public or demo data', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValue(err(new Error('secret')));
    expect(await f.service.read(ownerId, null)).toEqual(
      err(expect.any(CanonicalIdentityUnavailable))
    );
    expect(f.store.confirm).not.toHaveBeenCalled();
  });
  it('requires the current photo association and the same audience policy', async () => {
    const f = fixture();
    expect(await f.service.avatar(ownerId, requesterId, null)).toEqual(
      err(expect.any(PublicProfileNotFound))
    );
    f.store.inspect.mockResolvedValue({
      ...snapshot,
      profile: { ...snapshot.profile, avatarId: requesterId },
    });
    f.policy.evaluate.mockResolvedValue(ok(false));
    expect(await f.service.avatar(ownerId, requesterId, null)).toEqual(
      err(expect.any(PublicProfileNotFound))
    );
    expect(f.store.avatar).not.toHaveBeenCalled();
  });
  it('uses the discover policy separately from self-preview permission', async () => {
    const f = fixture();
    await f.service.directory(null, null);
    expect(f.policy.evaluate).toHaveBeenCalledWith('discover', snapshot.facts);
  });
  it('omits even shareable contact addresses from directory responses', async () => {
    const f = fixture();
    f.store.confirm.mockResolvedValue({ ...snapshot, profile: { ...snapshot.profile, contactEmail: 'shared@example.test' } });
    const result = await f.service.directory(null, null);
    expect(result.ok && result.value.profiles[0].contactEmail).toBeNull();
  });
  it('requires self policy before even inspecting follower commands', async () => {
    const f = fixture();
    f.validate.mockResolvedValue(ok(false));
    expect(await f.service.changeFollow(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
    expect(f.store.prepareFollow).not.toHaveBeenCalled();
    expect(await f.service.followers(null, ctx)).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
    expect(f.store.followers).not.toHaveBeenCalled();
  });
  it('does not let an owner/admin role substitute for requester authority', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValue(ok(false));
    expect(await f.service.changeFollow(input, 'key', ctx)).toEqual(
      err(expect.any(CanonicalIdentityAccessDenied))
    );
    expect(f.store.changeFollow).not.toHaveBeenCalled();
  });
  it('stores an authorized transition with the canonical fence and original command key', async () => {
    const f = fixture();
    await f.service.changeFollow(input, 'key', ctx);
    expect(f.policy.evaluate).toHaveBeenCalledWith(
      'request',
      snapshot.facts,
      requesterId
    );
    expect(f.store.changeFollow).toHaveBeenCalledWith(
      'requester',
      input,
      'key',
      snapshot,
      { ...follow, revision: 1, status: 'pending' }
    );
  });
  it('replays a committed historical receipt without rewriting a later relationship', async () => {
    const f = fixture();
    const receipt = { ...follow, revision: 1, status: 'pending' };
    f.store.prepareFollow.mockResolvedValue({ receipt });
    expect(await f.service.changeFollow(input, 'key', ctx)).toEqual(
      ok(receipt)
    );
    expect(f.policy.evaluate).not.toHaveBeenCalled();
    expect(f.store.changeFollow).not.toHaveBeenCalled();
  });
  it('rejects malformed IDs, commands and anonymous mutation attempts', async () => {
    const f = fixture();
    expect(await f.service.read('firebase-uid', null)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(
      await f.service.changeFollow({ ...input, status: 'approved' }, 'key', ctx)
    ).toEqual(err(expect.any(CanonicalIdentityInputError)));
    expect(await f.service.changeFollow(input, '', ctx)).toEqual(
      err(expect.any(CanonicalIdentityInputError))
    );
    expect(f.store.prepareFollow).not.toHaveBeenCalled();
  });
});
