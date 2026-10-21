import { ok, err } from '@sdk/kernel/standard';
import { PublicProfileActivityService } from './public-profile-activity.service';
import type { PublicProfileSnapshot } from './ports/public-profile.port';
import { CanonicalIdentityInputError } from '@sdk/features/identity/core';

const id = '00000000-0000-4000-8000-000000000001';
const item = {
  kind: 'article',
  id,
  at: 100,
  title: 'Public article',
  target: { kind: 'article', id, slug: 'public-article' },
};
const snapshot: PublicProfileSnapshot = {
  profile: {
    id,
    name: 'Member',
    bio: null,
    location: null,
    socialLinks: {},
    avatarId: null,
    registeredAt: 1,
  },
  facts: {
    ownerId: id,
    viewerId: null,
    visibility: 'public',
    ownerActive: true,
    viewerActive: true,
    viewerRegistered: false,
    approved: false,
    activityShared: true,
    suitesShared: true,
    favoritesShared: true,
    discussionsShared: true,
  },
  stamp: 'current',
  follow: null,
};
function fixture() {
  const policy = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const profiles = {
    inspect: jest.fn().mockResolvedValue(snapshot),
    confirm: jest.fn().mockResolvedValue(snapshot),
    avatar: jest.fn(),
    directory: jest.fn(),
    followers: jest.fn(),
    following: jest.fn(),
    prepareFollow: jest.fn(),
    changeFollow: jest.fn(),
  };
  const store = {
    contentOwner: jest.fn().mockResolvedValue('PrivateUid'),
    activityFavorites: jest.fn().mockResolvedValue([]),
  };
  const publication = {
    read: jest.fn().mockResolvedValue({ items: [item], through: null }),
  };
  const community = {
    read: jest.fn().mockResolvedValue({ items: [], through: null }),
  };
  const targets = { select: jest.fn().mockResolvedValue([]) };
  const cursors = {
    open: jest.fn(),
    seal: jest.fn().mockReturnValue(`a1.${'a'.repeat(80)}`),
  };
  return {
    policy,
    profiles,
    store,
    publication,
    community,
    targets,
    cursors,
    service: new PublicProfileActivityService(
      policy,
      profiles,
      store,
      [publication, community],
      targets,
      cursors
    ),
  };
}
describe('public activity audience and current account fence', () => {
  it('authorizes all sharing, privately resolves owner and confirms the profile after sources', async () => {
    const f = fixture();
    expect(await f.service.read(id, null, null)).toEqual(
      ok({ sharing: 'visible', items: [item], after: null })
    );
    expect(f.policy.evaluate.mock.calls.map(([action]) => action)).toEqual([
      'read',
      'read-activity',
      'read-suites',
      'read-discussions',
      'read-favorites',
    ]);
    expect(f.publication.read).toHaveBeenCalledWith('PrivateUid', null, {
      suites: true,
      discussions: true,
      favorites: true,
    });
    expect(f.profiles.confirm).toHaveBeenCalledWith(snapshot, null);
  });
  it.each([ok(false), err(new Error('policy outage'))])(
    'denies before owner/content calls on %j',
    async (decision) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(decision);
      expect((await f.service.read(id, null, null)).ok).toBe(false);
      expect(f.store.contentOwner).not.toHaveBeenCalled();
      expect(f.publication.read).not.toHaveBeenCalled();
    }
  );
  it('hides disabled activity even for an owner without querying dependencies', async () => {
    const f = fixture();
    f.policy.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(ok(false));
    expect(await f.service.read(id, 'PrivateUid', null)).toEqual(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    expect(f.publication.read).not.toHaveBeenCalled();
    expect(f.store.activityFavorites).not.toHaveBeenCalled();
  });
  it('does not read favorites when they are not shared and rejects a source leaking a hidden category', async () => {
    const f = fixture();
    f.policy.evaluate.mockImplementation((action: string) =>
      Promise.resolve(ok(!['read-favorites', 'read-suites'].includes(action)))
    );
    expect((await f.service.read(id, null, null)).ok).toBe(true);
    expect(f.store.activityFavorites).not.toHaveBeenCalled();
    f.publication.read.mockResolvedValue({
      items: [{ ...item, kind: 'suite', target: { kind: 'suite', id } }],
      through: null,
    });
    expect((await f.service.read(id, null, null)).ok).toBe(false);
  });
  it('discards results on audience, follower, session or saved-relation revision change', async () => {
    const f = fixture();
    f.profiles.confirm.mockResolvedValue(null);
    expect((await f.service.read(id, null, null)).ok).toBe(false);
  });
  it('fails truthfully on provider outage, extra private fields and an unrequested favorite', async () => {
    const f = fixture();
    f.community.read.mockRejectedValueOnce(new Error('outage'));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    f.community.read.mockResolvedValueOnce({
      items: [],
      through: null,
      owner: 'secret',
    });
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    f.store.activityFavorites.mockResolvedValue([
      { kind: 'articles', id, addedAt: 90 },
    ]);
    f.targets.select.mockResolvedValue([
      {
        kind: 'articles',
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Other',
        slug: 'other',
        applicationSlug: null,
      },
    ]);
    expect((await f.service.read(id, null, null)).ok).toBe(false);
  });
  it('uses the saved timestamp for current favorite metadata', async () => {
    const f = fixture();
    f.store.activityFavorites.mockResolvedValue([
      { kind: 'articles', id, addedAt: 90 },
    ]);
    f.targets.select.mockResolvedValue([
      {
        kind: 'articles',
        id,
        title: 'Public article',
        slug: 'public-article',
        applicationSlug: null,
      },
    ]);
    const result = await f.service.read(id, null, null);
    expect(result.ok && result.value.items[1]).toEqual({
      ...item,
      kind: 'favorite-article',
      at: 90,
    });
  });
  it('rejects tampered scoped cursors before owner/content I/O', async () => {
    const f = fixture();
    f.cursors.open.mockImplementation(() => {
      throw new Error('authentication failed');
    });
    const result = await f.service.read(id, null, `a1.${'a'.repeat(80)}`);
    expect(!result.ok && result.error).toBeInstanceOf(
      CanonicalIdentityInputError
    );
    expect(f.publication.read).not.toHaveBeenCalled();
    expect(f.store.contentOwner).not.toHaveBeenCalled();
  });
});
