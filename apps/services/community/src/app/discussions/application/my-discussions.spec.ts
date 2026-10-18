import { ok, err } from '@sdk/kernel/standard';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  MyDiscussions,
  type MyDiscussionCandidate,
  type MyDiscussionIndex,
  type MyDiscussionReader,
} from './my-discussions';
import { DiscussionNotFoundError } from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';

const id = (value: number) =>
  `10000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
const row = (n = 1): MyDiscussionCandidate => ({
  id: id(n),
  applicationId: id(100),
  at: 1000 - n,
  revision: 2,
  participation: 'participant',
});

describe('canonical My Discussions use case', () => {
  let index: jest.Mocked<MyDiscussionIndex>,
    reader: jest.Mocked<MyDiscussionReader>,
    evaluate: jest.Mock,
    service: MyDiscussions;
  beforeEach(() => {
    index = {
      list: jest.fn().mockResolvedValue([row()]),
      current: jest.fn().mockResolvedValue([row()]),
    };
    reader = {
      read: jest
        .fn()
        .mockResolvedValue({
          id: id(1),
          revision: 2,
          title: 'A real topic',
          tags: [],
          replyCount: 4,
          comments: [],
        }),
    };
    evaluate = jest.fn().mockResolvedValue(ok(true));
    service = new MyDiscussions(index, reader, { evaluate });
  });
  it('authorizes self scope before reading private membership, using the current actor and tenant', async () => {
    const page = await service.list(actor, {});
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Alice',
        tenantId: 'default',
        action: 'discussion.my-topics.read',
        resource: {
          type: 'my-discussion-workspace',
          id: 'Alice',
          tenantId: 'default',
        },
      })
    );
    expect(index.list).toHaveBeenCalledWith(actor, null);
    expect(index.current).toHaveBeenCalledWith(actor, [id(1)]);
    expect(reader.read).toHaveBeenCalledWith(id(100), id(1), actor, true);
    expect(page).toEqual({
      items: [
        {
          id: id(1),
          applicationId: id(100),
          createdAt: 999,
          title: 'A real topic',
          replyCount: 4,
          participation: 'participant',
        },
      ],
      next: null,
    });
  });
  it('fails closed on false or unavailable policy before any data access', async () => {
    evaluate
      .mockResolvedValueOnce(ok(false))
      .mockResolvedValueOnce(err(new Error('OPA unavailable')));
    await expect(service.list(actor, {})).rejects.toBeInstanceOf(
      PermissionDeniedError
    );
    await expect(service.list(actor, {})).rejects.toThrow('OPA unavailable');
    expect(index.list).not.toHaveBeenCalled();
    expect(reader.read).not.toHaveBeenCalled();
  });
  it('rejects injected account/tenant filters and invalid cursors before storage', async () => {
    for (const query of [
      { identityId: 'Bob' },
      { tenantId: 'other' },
      { cursor: ['x'] },
    ])
      await expect(service.list(actor, query)).rejects.toThrow();
    expect(index.list).not.toHaveBeenCalled();
  });
  it('bounds hidden-target scanning to ten candidates and preserves a continuation', async () => {
    index.list.mockResolvedValue(
      Array.from({ length: 11 }, (_, n) => row(n + 1))
    );
    reader.read.mockRejectedValue(new DiscussionNotFoundError());
    const page = await service.list(actor, {});
    expect(page).toEqual({ items: [], next: `990.${id(10)}` });
    expect(reader.read).toHaveBeenCalledTimes(10);
    expect(index.current).toHaveBeenCalledWith(actor, []);
  });
  it('rechecks participation after projection IO and omits deleted contributions', async () => {
    index.current.mockResolvedValue([]);
    expect((await service.list(actor, {})).items).toEqual([]);
  });
  it('rejects changed revisions/bindings and never disguises projection or dependency failure as empty', async () => {
    index.current
      .mockResolvedValueOnce([{ ...row(), revision: 3 }])
      .mockResolvedValueOnce([{ ...row(), applicationId: id(101) }]);
    await expect(service.list(actor, {})).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
    await expect(service.list(actor, {})).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
    reader.read
      .mockRejectedValueOnce(new DiscussionProjectionPendingError())
      .mockRejectedValueOnce(new Error('Editorial unavailable'));
    await expect(service.list(actor, {})).rejects.toBeInstanceOf(
      DiscussionProjectionPendingError
    );
    await expect(service.list(actor, {})).rejects.toThrow(
      'Editorial unavailable'
    );
  });
  it('passes immutable topic-time keysets and rejects broken index bounds', async () => {
    await service.list(actor, { cursor: `999.${id(1)}` });
    expect(index.list).toHaveBeenCalledWith(actor, { at: 999, id: id(1) });
    index.list.mockResolvedValue([row(), row()]);
    await expect(service.list(actor, {})).rejects.toThrow(
      'Invalid discussion participation page'
    );
  });
});
