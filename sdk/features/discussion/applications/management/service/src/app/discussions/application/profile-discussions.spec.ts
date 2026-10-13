import { ok, err } from '@sdk/kernel/standard';
import {
  ProfileDiscussions,
  type ProfileDiscussionIndex,
  type ProfileDiscussionReader,
  type ProfileDiscussionParents,
  type ProfileDiscussionCandidate,
} from './profile-discussions';
import {
  DiscussionNotFoundError,
  type DiscussionActor,
} from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';
import { EncryptedProfileDiscussionCursors } from '../infrastructure/profile-discussion-cursors';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = {
  identityId: 'wapps-profile-reader',
  tenantId: 'default',
  roles: ['discussion:profile-reader'],
};
const request = { ownerIdentityId: 'OwnerUid', after: null };
const candidate = (
  n = 1,
  kind: 'article' | 'application' = 'application'
): ProfileDiscussionCandidate => ({
  id: id(n),
  target: { kind, id: id(100) },
  at: 1000 - n,
  revision: 2,
  participation: 'participant',
});
describe('public profile discussion participation', () => {
  let index: jest.Mocked<ProfileDiscussionIndex>,
    reader: jest.Mocked<ProfileDiscussionReader>,
    parents: jest.Mocked<ProfileDiscussionParents>,
    evaluate: jest.Mock,
    service: ProfileDiscussions;
  const cursors = new EncryptedProfileDiscussionCursors('qualification-secret');
  beforeEach(() => {
    index = {
      list: jest.fn().mockResolvedValue([candidate()]),
      current: jest.fn().mockResolvedValue([candidate()]),
    };
    reader = {
      read: jest
        .fn()
        .mockResolvedValue({
          id: id(1),
          revision: 2,
          title: 'A public topic',
          comments: [],
          replyCount: 2,
        }),
    };
    parents = {
      select: jest
        .fn()
        .mockResolvedValue([
          {
            target: candidate().target,
            title: 'An application',
            slug: 'an-application',
          },
        ]),
    };
    evaluate = jest.fn().mockResolvedValue(ok(true));
    service = new ProfileDiscussions(
      index,
      reader,
      parents,
      cursors,
      { evaluate },
      'default'
    );
  });
  it('requires scoped service policy and current participant authority before returning minimal public metadata', async () => {
    expect(await service.read(request, actor)).toEqual({
      sharing: 'visible',
      items: [
        {
          id: id(1),
          parentId: id(100),
          parentKind: 'application',
          parentSlug: 'an-application',
          title: 'A public topic',
          createdAt: 999,
          replyCount: 2,
          participation: 'participant',
        },
      ],
      after: null,
    });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionName: 'discussion.profile.participation.read',
        resource: {
          type: 'profile-discussion-collection',
          id: 'OwnerUid',
          tenantId: 'default',
        },
      })
    );
    expect(index.list).toHaveBeenCalledWith('OwnerUid', 'default', null);
    expect(reader.read).toHaveBeenCalledWith(candidate().target, id(1));
    expect(index.current).toHaveBeenCalledWith('OwnerUid', 'default', [id(1)]);
  });
  it.each<DiscussionActor>([
    { ...actor, identityId: 'Member' },
    { ...actor, tenantId: 'other' },
    { ...actor, roles: ['admin'] },
    { ...actor, roles: [] },
  ])(
    'rejects service impersonation or foreign tenant before any reads: %j',
    async (viewer) => {
      await expect(service.read(request, viewer)).rejects.toThrow();
      expect(evaluate).not.toHaveBeenCalled();
      expect(index.list).not.toHaveBeenCalled();
    }
  );
  it('denies false/unavailable policy and injected private scope', async () => {
    evaluate
      .mockResolvedValueOnce(ok(false))
      .mockResolvedValueOnce(err(new Error('OPA unavailable')));
    await expect(service.read(request, actor)).rejects.toThrow();
    await expect(service.read(request, actor)).rejects.toThrow(
      'OPA unavailable'
    );
    for (const body of [
      { ...request, tenantId: 'other' },
      { ...request, ownerIdentityId: '' },
      { ...request, after: id(1) },
    ])
      await expect(service.read(body, actor)).rejects.toThrow();
    expect(index.list).not.toHaveBeenCalled();
  });
  it('shares article participation using the current public article title and route', async () => {
    index.list.mockResolvedValue([candidate(1, 'article')]);
    index.current.mockResolvedValue([candidate(1, 'article')]);
    reader.read.mockResolvedValue({
      id: id(1),
      revision: 2,
      replyCount: 2,
      comments: [],
    });
    parents.select.mockResolvedValue([
      {
        target: candidate(1, 'article').target,
        title: 'Reviewed article',
        slug: 'reviewed-article',
      },
    ]);
    expect((await service.read(request, actor)).items[0]).toMatchObject({
      parentKind: 'article',
      title: 'Reviewed article',
      parentSlug: 'reviewed-article',
    });
  });
  it('uses a sealed continuation after bounded hidden-parent scanning without leaking candidate IDs', async () => {
    index.list.mockResolvedValue(
      Array.from({ length: 11 }, (_, n) => candidate(n + 1))
    );
    reader.read.mockRejectedValue(new DiscussionNotFoundError());
    const page = await service.read(request, actor);
    expect(page.items).toEqual([]);
    expect(reader.read).toHaveBeenCalledTimes(10);
    expect(typeof page.after).toBe('string');
    expect(cursors.open(page.after as string, 'OwnerUid', 'default')).toEqual({
      at: 990,
      id: id(10),
    });
    index.list.mockResolvedValue([]);
    await service.read({ ...request, after: page.after }, actor);
    expect(index.list).toHaveBeenLastCalledWith('OwnerUid', 'default', {
      at: 990,
      id: id(10),
    });
  });
  it('omits removed contribution membership or withdrawn parents after content IO', async () => {
    index.current.mockResolvedValueOnce([]);
    expect((await service.read(request, actor)).items).toEqual([]);
    parents.select.mockResolvedValue([]);
    expect((await service.read(request, actor)).items).toEqual([]);
  });
  it('rejects changed revisions and targets, missing generations and parent outages', async () => {
    index.current
      .mockResolvedValueOnce([{ ...candidate(), revision: 3 }])
      .mockResolvedValueOnce([
        { ...candidate(), target: { kind: 'article', id: id(100) } },
      ]);
    await expect(service.read(request, actor)).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
    await expect(service.read(request, actor)).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
    reader.read.mockRejectedValueOnce(new DiscussionProjectionPendingError());
    await expect(service.read(request, actor)).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
    parents.select.mockRejectedValueOnce(new Error('Editorial unavailable'));
    await expect(service.read(request, actor)).rejects.toThrow(
      'Editorial unavailable'
    );
  });
  it('rejects malformed index bounds/order and owner-mismatched continuations', async () => {
    const token = cursors.seal({ at: 1000, id: id(1) }, 'OtherUid', 'default');
    await expect(
      service.read({ ...request, after: token }, actor)
    ).rejects.toThrow('cursor');
    expect(index.list).not.toHaveBeenCalled();
    for (const rows of [
      [candidate(), candidate()],
      [candidate(2), candidate(1)],
      Array.from({ length: 12 }, (_, n) => candidate(n)),
    ]) {
      index.list.mockResolvedValue(rows);
      await expect(service.read(request, actor)).rejects.toThrow(
        'Invalid profile participation'
      );
    }
  });
});
