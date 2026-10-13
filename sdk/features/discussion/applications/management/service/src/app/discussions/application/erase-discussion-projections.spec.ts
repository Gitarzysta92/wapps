import {
  EraseDiscussionProjections,
  type DiscussionProjectionErasureRepository,
  type DiscussionProjectionErasureStore,
} from './erase-discussion-projections';

const request = { identityId: 'ErasedOwner', revision: 7 };
const target = { nodeId: 'node', discussionId: 'discussion', revision: 5 };
function fixture(stopped = true) {
  const repository: jest.Mocked<DiscussionProjectionErasureRepository> = {
    next: jest.fn().mockResolvedValue(target),
    complete: jest.fn().mockResolvedValue(undefined),
  };
  const projections: jest.Mocked<DiscussionProjectionErasureStore> = {
    purge: jest.fn().mockResolvedValue(true),
    purgeLegacyBatch: jest.fn().mockResolvedValue(false),
    assertNoAttribution: jest.fn().mockResolvedValue(undefined),
  };
  return {
    repository,
    projections,
    worker: new EraseDiscussionProjections(repository, projections, stopped),
  };
}

describe('bounded Discussion projection erasure', () => {
  it('requires the old-worker fence before reading authority or mutating projections', async () => {
    const { worker, repository, projections } = fixture(false);
    await expect(worker.advance(request)).rejects.toThrow('Drain and fence');
    expect(repository.next).not.toHaveBeenCalled();
    expect(projections.purge).not.toHaveBeenCalled();
  });
  it('keeps a durable target while the anonymous projection is pending or old copies remain', async () => {
    const { worker, repository, projections } = fixture();
    projections.purge.mockResolvedValue(false);
    await expect(worker.advance(request)).resolves.toBe('pending');
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it('removes the target only after projection cleanup succeeds, then requires another bounded pass', async () => {
    const { worker, repository, projections } = fixture();
    await expect(worker.advance(request)).resolves.toBe('pending');
    expect(repository.complete).toHaveBeenCalledWith(request, target);
    expect(projections.purge.mock.invocationCallOrder[0]).toBeLessThan(
      repository.complete.mock.invocationCallOrder[0]
    );
  });
  it('propagates projection failure without removing its target', async () => {
    const { worker, repository, projections } = fixture();
    projections.purge.mockRejectedValue(new Error('Mongo unavailable'));
    await expect(worker.advance(request)).rejects.toThrow('Mongo unavailable');
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it('does not claim drained before obsolete orphan projections and current attribution are checked', async () => {
    const { worker, repository, projections } = fixture();
    repository.next.mockResolvedValue(null);
    projections.purgeLegacyBatch.mockResolvedValueOnce(true);
    await expect(worker.advance(request)).resolves.toBe('pending');
    expect(projections.assertNoAttribution).not.toHaveBeenCalled();
    projections.assertNoAttribution.mockRejectedValueOnce(
      new Error('Unaccounted attribution')
    );
    await expect(worker.advance(request)).rejects.toThrow(
      'Unaccounted attribution'
    );
    await expect(worker.advance(request)).resolves.toBe('drained');
    expect(projections.assertNoAttribution).toHaveBeenLastCalledWith(
      request.identityId
    );
  });
});
