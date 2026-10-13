import type { EditorialProjectionKind } from '@apps/shared';
import {
  appContent,
  appSnapshot,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import {
  projectEditorialSnapshot,
  type EditorialProjectionStore,
  type EditorialSnapshotReader,
} from '../application/editorial-materialization';
import {
  EraseEditorialProjections,
  type EditorialProjectionErasureRepository,
  type EditorialProjectionErasureTarget,
} from './erase-editorial-projections';

const request = { identityId: 'ErasedAuthor', revision: 7 };
function fixture() {
  const target: EditorialProjectionErasureTarget = {
    kind: 'app',
    resourceId: editorialId(),
    tenantId: 'default',
    minimumRevision: 2,
  };
  const snapshot = appSnapshot({ revision: 2 });
  const projection = projectEditorialSnapshot(snapshot);
  const repository: jest.Mocked<EditorialProjectionErasureRepository> = {
    next: jest.fn().mockResolvedValue(target),
    complete: jest.fn().mockResolvedValue(true),
  };
  const reader: jest.Mocked<EditorialSnapshotReader> = {
    read: jest.fn().mockResolvedValue(snapshot),
  };
  const projections: jest.Mocked<EditorialProjectionStore> = {
    publish: jest.fn().mockResolvedValue('published'),
    find: jest.fn().mockResolvedValue(projection),
  };
  return {
    target,
    snapshot,
    projection,
    repository,
    reader,
    projections,
    worker: new EraseEditorialProjections(repository, reader, projections),
  };
}

describe('bounded Editorial projection erasure', () => {
  it('checks the exact request and canonical targets before reporting drained', async () => {
    const f = fixture();
    f.repository.next.mockResolvedValue(null);
    await expect(f.worker.advance(request)).resolves.toBe('drained');
    expect(f.repository.next).toHaveBeenCalledWith(request);
    expect(f.reader.read).not.toHaveBeenCalled();
    expect(f.repository.complete).not.toHaveBeenCalled();
    await expect(
      f.worker.advance({ ...request, revision: 0 })
    ).rejects.toThrow();
    expect(f.repository.next).toHaveBeenCalledTimes(1);
  });

  it('requires a separate pass after one durable publication, read confirmation and SQL recheck', async () => {
    const f = fixture();
    await expect(f.worker.advance(request)).resolves.toBe('pending');
    expect(f.reader.read).toHaveBeenCalledWith('app', editorialId());
    expect(f.projections.publish).toHaveBeenCalledWith(f.projection);
    expect(f.repository.complete).toHaveBeenCalledWith(
      request,
      f.target,
      f.projection
    );
    expect(f.projections.publish.mock.invocationCallOrder[0]).toBeLessThan(
      f.projections.find.mock.invocationCallOrder[0]
    );
    expect(f.projections.find.mock.invocationCallOrder[0]).toBeLessThan(
      f.repository.complete.mock.invocationCallOrder[0]
    );
    expect(f.repository.next).toHaveBeenCalledTimes(1);
  });

  it.each([
    { kind: 'unknown' },
    { resourceId: 'bad-id' },
    { tenantId: '' },
    { minimumRevision: 1 },
    { minimumRevision: 2.5 },
  ])('rejects corrupt targets before materialization: %p', async (invalid) => {
    const f = fixture();
    f.repository.next.mockResolvedValue({
      ...f.target,
      ...invalid,
    } as EditorialProjectionErasureTarget);
    await expect(f.worker.advance(request)).rejects.toThrow(
      'Invalid Editorial projection erasure target'
    );
    expect(f.reader.read).not.toHaveBeenCalled();
    expect(f.repository.complete).not.toHaveBeenCalled();
  });

  it.each([
    { resourceId: editorialId(2) },
    { tenantId: 'foreign' },
    { revision: 1 },
  ])('rejects stale or mis-scoped canonical snapshots: %p', async (invalid) => {
    const f = fixture();
    f.reader.read.mockResolvedValue({ ...f.snapshot, ...invalid });
    await expect(f.worker.advance(request)).rejects.toThrow(
      'differs from its canonical target'
    );
    expect(f.projections.publish).not.toHaveBeenCalled();
    expect(f.repository.complete).not.toHaveBeenCalled();
  });

  it.each([
    'app',
    'category',
    'tag',
    'suite',
    'article',
    'release',
  ] as EditorialProjectionKind[])(
    'retains %s tombstones through durable confirmation',
    async (kind) => {
      const f = fixture();
      const target = { ...f.target, kind };
      const snapshot = { ...f.snapshot, kind, deletedAt: 10, content: null };
      f.repository.next.mockResolvedValue(target);
      f.reader.read.mockResolvedValue(snapshot);
      const projection = projectEditorialSnapshot(snapshot);
      f.projections.find.mockResolvedValue(projection);
      await expect(f.worker.advance(request)).resolves.toBe('pending');
      expect(f.projections.publish).toHaveBeenCalledWith(projection);
      expect(f.repository.complete).toHaveBeenCalledWith(
        request,
        target,
        projection
      );
    }
  );

  it.each(['authority', 'snapshot', 'publish', 'read'])(
    'retains the durable target after a %s failure',
    async (phase) => {
      const f = fixture();
      const failure = new Error('Store unavailable');
      if (phase === 'authority') f.repository.next.mockRejectedValue(failure);
      if (phase === 'snapshot') f.reader.read.mockRejectedValue(failure);
      if (phase === 'publish') f.projections.publish.mockRejectedValue(failure);
      if (phase === 'read') f.projections.find.mockRejectedValue(failure);
      await expect(f.worker.advance(request)).rejects.toBe(failure);
      expect(f.repository.complete).not.toHaveBeenCalled();
    }
  );

  it.each([null, 1, 3])(
    'does not confuse a publication result with a matching durable document: %p',
    async (revision) => {
      const f = fixture();
      f.projections.find.mockResolvedValue(
        revision === null
          ? null
          : projectEditorialSnapshot(appSnapshot({ revision }))
      );
      await expect(f.worker.advance(request)).resolves.toBe('pending');
      expect(f.repository.complete).not.toHaveBeenCalled();
    }
  );

  it.each(['scope', 'conflict', 'corruption', 'unexpected attribution'])(
    'rejects %s in the stored projection',
    async (problem) => {
      const f = fixture();
      f.projections.find.mockResolvedValue(
        problem === 'scope'
          ? projectEditorialSnapshot({ ...f.snapshot, tenantId: 'foreign' })
          : problem === 'conflict'
          ? projectEditorialSnapshot({
              ...f.snapshot,
              content: { ...appContent(), name: 'Conflicting' },
            })
          : problem === 'corruption'
          ? { ...f.projection, fingerprint: 'bad' }
          : { ...f.projection, ownerIdentityId: request.identityId }
      );
      await expect(f.worker.advance(request)).rejects.toThrow();
      expect(f.repository.complete).not.toHaveBeenCalled();
    }
  );

  it('leaves a concurrent canonical update pending for another snapshot', async () => {
    const f = fixture();
    f.repository.complete.mockResolvedValueOnce(false);
    await expect(f.worker.advance(request)).resolves.toBe('pending');
    const snapshot = {
      ...f.snapshot,
      revision: 3,
      content: { ...appContent(), name: 'Successor edit' },
    };
    f.reader.read.mockResolvedValue(snapshot);
    const projection = projectEditorialSnapshot(snapshot);
    f.projections.find.mockResolvedValue(projection);
    await expect(f.worker.advance(request)).resolves.toBe('pending');
    expect(f.repository.complete).toHaveBeenLastCalledWith(
      request,
      f.target,
      projection
    );
  });

  it('retries after Mongo success and SQL failure without losing the target', async () => {
    const f = fixture();
    f.repository.complete.mockRejectedValueOnce(new Error('SQL unavailable'));
    await expect(f.worker.advance(request)).rejects.toThrow('SQL unavailable');
    f.projections.publish.mockResolvedValueOnce('unchanged');
    await expect(f.worker.advance(request)).resolves.toBe('pending');
    expect(f.repository.complete).toHaveBeenCalledTimes(2);
    f.repository.next.mockResolvedValueOnce(null);
    await expect(f.worker.advance(request)).resolves.toBe('drained');
  });
});
