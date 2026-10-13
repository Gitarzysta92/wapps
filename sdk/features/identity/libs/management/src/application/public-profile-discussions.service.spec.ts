import { ok, err } from '@sdk/kernel/standard';
import { PublicProfileDiscussionsService } from './public-profile-discussions.service';
import type { PublicProfileSnapshot } from './ports/public-profile.port';

const id = '00000000-0000-4000-8000-000000000001';
const discussion = {
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Published discussion',
  parentKind: 'application',
  parentId: id,
  parentSlug: 'public-app',
  createdAt: 100,
  replyCount: 1,
  participation: 'participant',
};
const page = { sharing: 'visible', items: [discussion], after: null };
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
    discussionsShared: true,
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
  const owners = {
    contentOwner: jest.fn().mockResolvedValue('PrivateOwnerUid'),
  };
  const discussions = { read: jest.fn().mockResolvedValue(page) };
  return {
    policy,
    profiles,
    owners,
    discussions,
    service: new PublicProfileDiscussionsService(
      policy,
      profiles,
      owners,
      discussions
    ),
  };
}
describe('shared published discussions authorization', () => {
  it('authorizes audience and sharing before resolving the private owner and checks current facts afterward', async () => {
    const f = fixture();
    expect(await f.service.read(id, null, null)).toEqual(ok(page));
    expect(f.policy.evaluate.mock.calls.map((call) => call[0])).toEqual([
      'read',
      'read-discussions',
    ]);
    expect(f.owners.contentOwner).toHaveBeenCalledWith(snapshot, null);
    expect(f.discussions.read).toHaveBeenCalledWith('PrivateOwnerUid', null);
    expect(f.profiles.confirm).toHaveBeenCalledWith(snapshot, null);
  });
  it('hides disabled sharing without private owner or target calls', async () => {
    const f = fixture();
    f.policy.evaluate
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValueOnce(ok(false));
    expect(await f.service.read(id, null, null)).toEqual(
      ok({ sharing: 'hidden', items: [], after: null })
    );
    expect(f.owners.contentOwner).not.toHaveBeenCalled();
    expect(f.discussions.read).not.toHaveBeenCalled();
  });
  it.each([ok(false), err(new Error('policy outage'))])(
    'fails closed before owner or target reads on audience decision %j',
    async (decision) => {
      const f = fixture();
      f.policy.evaluate.mockResolvedValue(decision);
      expect((await f.service.read(id, null, null)).ok).toBe(false);
      expect(f.owners.contentOwner).not.toHaveBeenCalled();
      expect(f.discussions.read).not.toHaveBeenCalled();
    }
  );
  it('rejects snapshot changes before or after content I/O', async () => {
    const f = fixture();
    f.owners.contentOwner.mockRejectedValueOnce(new Error('changed'));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    expect(f.discussions.read).not.toHaveBeenCalled();
    f.profiles.confirm.mockResolvedValue(null);
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    expect(f.discussions.read).toHaveBeenCalledTimes(1);
  });
  it('never substitutes successful emptiness for failed or malformed selection', async () => {
    const f = fixture();
    f.discussions.read.mockRejectedValueOnce(new Error('lag'));
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    f.discussions.read.mockResolvedValue({
      sharing: 'hidden',
      items: [],
      after: null,
    });
    expect((await f.service.read(id, null, null)).ok).toBe(false);
    f.discussions.read.mockResolvedValue(page);
    expect((await f.service.read(id, null, discussion.id)).ok).toBe(false);
  });
  it('rejects malformed IDs and cursors before policy/storage', async () => {
    const f = fixture();
    for (const [owner, viewer, after] of [
      ['slug', null, null],
      [id, '', null],
      [id, null, ['cursor']],
    ] as const)
      expect((await f.service.read(owner, viewer, after)).ok).toBe(false);
    expect(f.profiles.inspect).not.toHaveBeenCalled();
  });
});
