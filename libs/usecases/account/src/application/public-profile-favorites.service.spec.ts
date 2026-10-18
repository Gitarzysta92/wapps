import { ok, err } from '@sdk/kernel/standard';
import { PublicProfileFavoritesService } from './public-profile-favorites.service';
import type { PublicProfileSnapshot } from './ports/public-profile.port';

const id = '00000000-0000-4000-8000-000000000001';
const target = {
  kind: 'applications' as const,
  id: '00000000-0000-4000-8000-000000000002',
};
const visible = {
  ...target,
  title: 'Current app',
  slug: 'current-app',
  applicationSlug: null,
};
const snapshot: PublicProfileSnapshot = {
  profile: {
    id,
    name: 'Owner',
    bio: null,
    location: null,
    avatarId: null,
    socialLinks: {},
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
    favoritesShared: true,
  },
  follow: null,
  stamp: 'current',
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
  const store = { profileFavorites: jest.fn().mockResolvedValue([target]) };
  const targets = { select: jest.fn().mockResolvedValue([visible]) };
  return {
    policy,
    profiles,
    store,
    targets,
    service: new PublicProfileFavoritesService(
      policy,
      profiles,
      store,
      targets
    ),
  };
}
describe('public profile favorites authorization', () => {
  it('requires audience access before reading any saved relation or target', async () => {
    const f = fixture();
    f.policy.evaluate.mockResolvedValue(ok(false));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    expect(f.store.profileFavorites).not.toHaveBeenCalled();
    expect(f.targets.select).not.toHaveBeenCalled();
  });
  it('returns a hidden section without target calls when sharing is denied', async () => {
    const f = fixture();
    f.policy.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(ok(false));
    expect(await f.service.read(id, null, null)).toEqual(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    expect(f.store.profileFavorites).not.toHaveBeenCalled();
    expect(f.profiles.confirm).toHaveBeenCalledWith(snapshot, null);
  });
  it('checks the sharing action and returns only currently resolved targets', async () => {
    const f = fixture();
    expect(await f.service.read(id, null, null)).toEqual(
      ok({ sharing: 'visible', items: [visible], after: null })
    );
    expect(f.policy.evaluate).toHaveBeenNthCalledWith(
      2,
      'read-favorites',
      snapshot.facts
    );
    expect(f.store.profileFavorites).toHaveBeenCalledWith(snapshot, null);
  });
  it('withholds results after a privacy, relation or lifecycle change during target resolution', async () => {
    const f = fixture();
    f.profiles.confirm.mockResolvedValue(null);
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    expect(f.targets.select).toHaveBeenCalledTimes(1);
  });
  it('does not reach external targets when the pre-read snapshot changed', async () => {
    const f = fixture();
    f.store.profileFavorites.mockRejectedValue(new Error('changed'));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    expect(f.targets.select).not.toHaveBeenCalled();
  });
  it('propagates target/policy failures without fabricating an empty page', async () => {
    const f = fixture();
    f.targets.select.mockRejectedValue(new Error('offline'));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    f.policy.evaluate.mockResolvedValue(err(new Error('policy unavailable')));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
  });
  it('does not call content services for an empty shared list', async () => {
    const f = fixture();
    f.store.profileFavorites.mockResolvedValue([]);
    expect(await f.service.read(id, null, null)).toEqual(
      ok({ sharing: 'visible', items: [], after: null })
    );
    expect(f.targets.select).not.toHaveBeenCalled();
  });
  it('rejects unrequested content and unknown query scope', async () => {
    const f = fixture();
    f.targets.select.mockResolvedValue([{ ...visible, id }]);
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    expect((await f.service.read(id, null, { ownerId: 'other' })).ok).toBe(
      false
    );
  });
});
