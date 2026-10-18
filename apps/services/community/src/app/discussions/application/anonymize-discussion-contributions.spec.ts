import { createHash } from 'node:crypto';
import {
  AnonymizeDiscussionContributions,
  type DiscussionContributionErasureRepository,
  type DiscussionErasureNode,
  type DiscussionErasurePayloads,
} from './anonymize-discussion-contributions';
import { anonymousDiscussionPayload } from './discussion-anonymity';

const request = { identityId: 'ErasedOwner', revision: 3 };
const id = '40e90383-a22e-4b5f-83c3-a7ef97f2e730';
const node: DiscussionErasureNode = {
  id,
  discussionId: id,
  tenantId: 'default',
  target: { kind: 'article', id },
  kind: 'discussion',
  state: 'published',
  visibility: 'public',
  deletedAt: null,
  rootState: 'published',
  rootVisibility: 'public',
  rootDeletedAt: null,
  retain: true,
  payload: {
    key: `discussions/${id}/versions/${id}.json`,
    sha256: 'a'.repeat(64),
    bytes: 50,
  },
};
function fixture() {
  const repository: jest.Mocked<DiscussionContributionErasureRepository> = {
    next: jest.fn().mockResolvedValue(node),
    reserve: jest.fn().mockResolvedValue(true),
    commit: jest.fn().mockResolvedValue(undefined),
  };
  const payloads: jest.Mocked<DiscussionErasurePayloads> = {
    read: jest.fn().mockResolvedValue({
      displayName: 'Identifying name',
      text: 'Keep authored content',
    }),
    put: jest.fn().mockResolvedValue(undefined),
  };
  return {
    repository,
    payloads,
    worker: new AnonymizeDiscussionContributions(repository, payloads),
  };
}

describe('canonical Discussion contribution erasure', () => {
  it('does not upload if another worker already removed ownership before reservation', async () => {
    const { worker, repository, payloads } = fixture();
    repository.reserve.mockResolvedValue(false);
    await expect(worker.advance(request)).resolves.toBe(true);
    expect(payloads.put).not.toHaveBeenCalled();
    expect(repository.commit).not.toHaveBeenCalled();
  });
  it('reserves before immutable upload and commits the neutral author copy afterwards', async () => {
    const { worker, repository, payloads } = fixture();
    await expect(worker.advance(request)).resolves.toBe(true);
    const [reference, body] = payloads.put.mock.calls[0];
    expect(JSON.parse(body.toString())).toEqual({
      content: {
        text: 'Keep authored content',
      },
    });
    expect(reference).toMatchObject({
      sha256: createHash('sha256').update(body).digest('hex'),
      bytes: body.length,
    });
    expect(repository.reserve).toHaveBeenCalledWith(request, node, reference);
    expect(repository.commit).toHaveBeenCalledWith(request, node, reference);
    expect(repository.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      payloads.put.mock.invocationCallOrder[0]
    );
    expect(payloads.put.mock.invocationCallOrder[0]).toBeLessThan(
      repository.commit.mock.invocationCallOrder[0]
    );
  });

  it('reuses the exact immutable copy after a failure between upload and canonical commit', async () => {
    const { worker, repository, payloads } = fixture();
    repository.commit.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(worker.advance(request)).rejects.toThrow(
      'database unavailable'
    );
    await worker.advance(request);
    expect(payloads.put.mock.calls[1]).toEqual(payloads.put.mock.calls[0]);
  });

  it('does not upload after a failed reservation or commit after a failed upload', async () => {
    const { worker, repository, payloads } = fixture();
    repository.reserve.mockRejectedValueOnce(new Error('owner changed'));
    await expect(worker.advance(request)).rejects.toThrow('owner changed');
    expect(payloads.put).not.toHaveBeenCalled();
    payloads.put.mockRejectedValueOnce(new Error('object unavailable'));
    await expect(worker.advance(request)).rejects.toThrow('object unavailable');
    expect(repository.commit).not.toHaveBeenCalled();
  });

  it('clears private payload pointers without reading or copying private bodies', async () => {
    const { worker, repository, payloads } = fixture();
    const privateNode = { ...node, retain: false, visibility: 'private' };
    repository.next.mockResolvedValue(privateNode);
    await worker.advance(request);
    expect(repository.commit).toHaveBeenCalledWith(request, privateNode, null);
    expect(payloads.read).not.toHaveBeenCalled();
    expect(payloads.put).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
  });

  it('returns no progress when there are no owned nodes, without declaring full erasure complete', async () => {
    const { worker, repository, payloads } = fixture();
    repository.next.mockResolvedValue(null);
    await expect(worker.advance(request)).resolves.toBe(false);
    expect(repository.commit).not.toHaveBeenCalled();
    expect(payloads.read).not.toHaveBeenCalled();
  });

  it('requires an immutable payload for retained contributions', async () => {
    const { worker, repository, payloads } = fixture();
    repository.next.mockResolvedValue({ ...node, payload: null });
    await expect(worker.advance(request)).rejects.toThrow('immutable payload');
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(payloads.put).not.toHaveBeenCalled();
  });

  it('rejects malformed requests before persistence access', async () => {
    const { worker, repository } = fixture();
    await expect(worker.advance({ ...request, revision: 0 })).rejects.toThrow();
    expect(repository.next).not.toHaveBeenCalled();
  });

  it('drops legacy envelope metadata and generic display names without rewriting authored text', () => {
    expect(
      anonymousDiscussionPayload({
        content: { displayName: 'Old name', text: 'Authored text' },
        ownerIdentityId: 'private identity',
        ip: 'private address',
      })
    ).toEqual({ content: { text: 'Authored text' } });
    expect(
      anonymousDiscussionPayload({
        content: 'Authored text',
        metadata: 'private',
      })
    ).toEqual({ content: 'Authored text' });
    expect(() => anonymousDiscussionPayload({ metadata: 'private' })).toThrow(
      'Missing'
    );
  });
});
