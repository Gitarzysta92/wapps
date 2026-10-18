import { PublicDiscussionSelection } from './discussion-selection';
import {
  DiscussionNotFoundError,
  type DiscussionResource,
} from './discussion-write.port';
import { DiscussionProjectionPendingError } from './discussion-queries';

const id = '10000000-0000-4000-8000-000000000001';
const applicationId = '10000000-0000-4000-8000-000000000002';
const resource: DiscussionResource = {
  id,
  discussionId: id,
  revision: 2,
  tenantId: 'default',
  ownerIdentityId: 'PrivateAlice',
  rootOwnerIdentityId: 'PrivateAlice',
  kind: 'discussion',
  state: 'published',
  rootState: 'published',
  visibility: 'public',
  rootVisibility: 'public',
  deletedAt: null,
  rootDeletedAt: null,
  target: { kind: 'application', id: applicationId },
};
const thread = {
  id,
  revision: 2,
  title: 'A real topic',
  tags: [],
  replyCount: 3,
  comments: [],
};

describe('public discussion selection authority', () => {
  let current: jest.Mock,
    read: jest.Mock,
    visible: jest.Mock,
    selection: PublicDiscussionSelection;
  beforeEach(() => {
    current = jest.fn().mockResolvedValue(resource);
    read = jest.fn().mockResolvedValue(thread);
    visible = jest.fn().mockResolvedValue(true);
    selection = new PublicDiscussionSelection(
      { resource: current },
      { read },
      { visible },
      'default'
    );
  });
  it('resolves the immutable SQL parent, reads only a root and returns no private identity or body', async () => {
    expect(await selection.select({ ids: id })).toEqual({
      items: [
        {
          id,
          applicationId,
          revision: 2,
          title: 'A real topic',
          replyCount: 3,
        },
      ],
    });
    expect(read).toHaveBeenCalledWith(applicationId, id, null, true);
    expect(current).toHaveBeenCalledTimes(2);
    expect(visible).toHaveBeenCalledWith(resource.target, 'default');
  });
  it('rejects injected tenant/parent filters and unbounded input before reading authority', async () => {
    for (const input of [
      { ids: id, tenantId: 'other' },
      { ids: id, applicationId },
      { ids: `${id},${id}` },
      { ids: Array(51).fill(id).join(',') },
    ])
      await expect(selection.select(input)).rejects.toThrow();
    expect(current).not.toHaveBeenCalled();
  });
  it('omits missing, private, deleted, other-tenant, article, generic and reply targets before projection access', async () => {
    for (const value of [
      null,
      { ...resource, deletedAt: 1 },
      { ...resource, rootDeletedAt: 1 },
      { ...resource, visibility: 'private' },
      { ...resource, rootVisibility: 'private' },
      { ...resource, state: 'draft' },
      { ...resource, rootState: 'draft' },
      { ...resource, tenantId: 'other' },
      { ...resource, kind: 'comment' },
      { ...resource, discussionId: applicationId },
      { ...resource, target: null },
      { ...resource, target: { kind: 'article', id: applicationId } },
    ]) {
      current.mockResolvedValue(value);
      expect(await selection.select({ ids: id })).toEqual({ items: [] });
    }
    expect(read).not.toHaveBeenCalled();
  });
  it('omits deletion or parent withdrawal during IO, while changed revisions/bindings fail pending', async () => {
    current
      .mockResolvedValueOnce(resource)
      .mockResolvedValueOnce({ ...resource, deletedAt: 1 });
    expect(await selection.select({ ids: id })).toEqual({ items: [] });
    visible.mockResolvedValueOnce(false);
    expect(await selection.select({ ids: id })).toEqual({ items: [] });
    for (const changed of [
      { ...resource, revision: 3 },
      { ...resource, target: { kind: 'application', id } },
    ]) {
      current.mockResolvedValueOnce(resource).mockResolvedValueOnce(changed);
      await expect(selection.select({ ids: id })).rejects.toBeInstanceOf(
        DiscussionProjectionPendingError
      );
    }
  });
  it('distinguishes canonical absence from missing projection or dependency failure', async () => {
    read.mockRejectedValueOnce(new DiscussionNotFoundError());
    expect(await selection.select({ ids: id })).toEqual({ items: [] });
    for (const error of [
      new DiscussionProjectionPendingError('pending'),
      new Error('dependency'),
    ]) {
      read.mockRejectedValueOnce(error);
      await expect(selection.select({ ids: id })).rejects.toBe(error);
    }
    visible.mockRejectedValueOnce(new Error('Editorial unavailable'));
    await expect(selection.select({ ids: id })).rejects.toThrow(
      'Editorial unavailable'
    );
  });
});
