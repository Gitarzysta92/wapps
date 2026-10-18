import { ok, err } from '@sdk/kernel/standard';
import {
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
  PublicCommentInputError,
} from '@domains/community';
import {
  DiscussionReplyNotifications,
  type ReplyNotificationJournal,
  type ReplyNotificationCandidate,
} from './reply-notifications';
import type { ProfileDiscussionParents } from './profile-discussions';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = {
  identityId: NOTIFICATION_WORKER_ID,
  tenantId: NOTIFICATION_WORKER_SCOPE,
  roles: [NOTIFICATION_WORKER_ROLE],
};
const candidate: ReplyNotificationCandidate = {
  event: {
    id: id(2),
    discussionId: id(1),
    parentId: id(1),
    recipientId: 'Owner',
    revision: 2,
    at: 100,
  },
  target: { kind: 'application', id: id(3) },
  currentRevision: 2,
};
const request = { operation: 'resolve', recipientId: 'Owner', ids: [id(2)] };
function fixture() {
  const journal: jest.Mocked<ReplyNotificationJournal> = {
    claim: jest.fn().mockResolvedValue(null),
    settle: jest.fn().mockResolvedValue('settled'),
    current: jest.fn().mockResolvedValue([candidate]),
  };
  const parents: jest.Mocked<ProfileDiscussionParents> = {
    select: jest.fn().mockResolvedValue([
      {
        target: candidate.target,
        title: 'Current application',
        slug: 'current-application',
      },
    ]),
  };
  const evaluate = jest.fn().mockResolvedValue(ok(true));
  return {
    journal,
    parents,
    evaluate,
    service: new DiscussionReplyNotifications(
      journal,
      parents,
      { evaluate },
      'public-tenant'
    ),
  };
}
describe('service-only reply notification source', () => {
  it.each([
    { ...actor, identityId: 'Owner' },
    { ...actor, tenantId: 'default' },
    { ...actor, roles: ['admin'] },
  ])('rejects impersonation before policy or storage: %j', async (input) => {
    const f = fixture();
    await expect(f.service.execute(request, input)).rejects.toThrow();
    expect(f.evaluate).not.toHaveBeenCalled();
    expect(f.journal.current).not.toHaveBeenCalled();
  });
  it.each([ok(false), err(new Error('policy unavailable'))])(
    'fails closed on denied/unavailable policy %j',
    async (decision) => {
      const f = fixture();
      f.evaluate.mockResolvedValue(decision);
      await expect(f.service.execute(request, actor)).rejects.toThrow();
      expect(f.journal.current).not.toHaveBeenCalled();
    }
  );
  it('selects current public metadata only after checking recipient membership before and after remote IO', async () => {
    const f = fixture();
    expect(await f.service.execute(request, actor)).toEqual({
      items: [
        {
          id: id(2),
          discussionId: id(1),
          target: candidate.target,
          title: 'Current application',
          slug: 'current-application',
        },
      ],
    });
    expect(f.journal.current.mock.calls).toEqual([
      ['Owner', [id(2)], 'public-tenant'],
      ['Owner', [id(2)], 'public-tenant'],
    ]);
    expect(f.parents.select.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.journal.current.mock.invocationCallOrder[0]
    );
    expect(f.parents.select.mock.invocationCallOrder[0]).toBeLessThan(
      f.journal.current.mock.invocationCallOrder[1]
    );
  });
  it('omits deleted replies or hidden parents, and refuses changed source snapshots', async () => {
    const f = fixture();
    f.journal.current
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([]);
    expect(await f.service.execute(request, actor)).toEqual({ items: [] });
    f.parents.select.mockResolvedValueOnce([]);
    expect(await f.service.execute(request, actor)).toEqual({ items: [] });
    f.journal.current
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([{ ...candidate, currentRevision: 3 }]);
    await expect(f.service.execute(request, actor)).rejects.toThrow('changed');
  });
  it.each([
    { ...request, ids: Array(11).fill(id(2)) },
    { ...request, ids: [id(2), id(2)] },
    { ...request, tenantId: 'foreign' },
    { operation: 'unknown' },
    { operation: 'ack', id: id(2), token: 'invalid' },
    { operation: 'claim', recipientId: 'Owner' },
  ])(
    'returns input errors without journal access for invalid input %j',
    async (input) => {
      const f = fixture();
      await expect(f.service.execute(input, actor)).rejects.toBeInstanceOf(
        PublicCommentInputError
      );
      expect(f.journal.current).not.toHaveBeenCalled();
      expect(f.journal.claim).not.toHaveBeenCalled();
      expect(f.journal.settle).not.toHaveBeenCalled();
    }
  );
  it('routes exact leased acknowledgements and explicit failures', async () => {
    const f = fixture();
    expect(await f.service.execute({ operation: 'claim' }, actor)).toEqual({
      lease: null,
    });
    expect(
      await f.service.execute(
        { operation: 'ack', id: id(2), token: id(4) },
        actor
      )
    ).toEqual({ status: 'settled' });
    await f.service.execute(
      { operation: 'defer', id: id(2), token: id(4) },
      actor
    );
    expect(f.journal.settle.mock.calls).toEqual([
      [id(2), id(4), false],
      [id(2), id(4), true],
    ]);
  });
});
