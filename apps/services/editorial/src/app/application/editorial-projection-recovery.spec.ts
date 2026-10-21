import {
  appSnapshot,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import { projectEditorialSnapshot } from './editorial-materialization';
import {
  EditorialRecoveryResource,
  EditorialRecoverySource,
  rebuildEditorialProjections,
  reconcileEditorialProjections,
} from './editorial-projection-recovery';

function fixture() {
  const state: EditorialRecoveryResource = {
    kind: 'app',
    resourceId: editorialId(),
    tenantId: 'default',
    revision: 2,
    deletedAt: null,
  };
  const source: jest.Mocked<EditorialRecoverySource> = {
    ceiling: jest.fn().mockResolvedValue(state),
    page: jest.fn().mockResolvedValueOnce([state]).mockResolvedValue([]),
    current: jest.fn().mockResolvedValue(state),
    enqueue: jest.fn().mockResolvedValue(true),
  };
  const reader = {
    read: jest.fn().mockResolvedValue(appSnapshot({ revision: 2 })),
  };
  const projections = {
    find: jest.fn().mockResolvedValue(null),
    publish: jest.fn(),
  };
  const results: unknown[] = [];
  return {
    state,
    source,
    reader,
    projections,
    results,
    inspect: (apply = false) =>
      reconcileEditorialProjections(source, reader, projections, {
        apply,
        onResult: (result) => results.push(result),
      }),
  };
}

describe('Editorial projection rebuild and reconciliation', () => {
  it('rebuilds from a bounded authoritative enumeration including tombstones without any broker/projection reads', async () => {
    const f = fixture();
    f.source.page
      .mockReset()
      .mockResolvedValueOnce([{ ...f.state, deletedAt: 100 }])
      .mockResolvedValue([]);
    const report = await rebuildEditorialProjections(f.source);
    expect(report).toMatchObject({ inspected: 1, queued: 1, failed: 0 });
    expect(f.source.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: 100 })
    );
    expect(f.source.page).toHaveBeenNthCalledWith(1, null, f.state, 100);
    expect(f.source.page).toHaveBeenNthCalledWith(
      2,
      { kind: 'app', resourceId: editorialId() },
      f.state,
      100
    );
  });

  it('reports missing projections without mutating either store during read-only inspection', async () => {
    const f = fixture();
    expect(await f.inspect()).toMatchObject({
      inspected: 1,
      needsRebuild: 1,
      queued: 0,
    });
    expect(f.source.enqueue).not.toHaveBeenCalled();
    expect(f.projections.publish).not.toHaveBeenCalled();
  });

  it('explicitly requeues a missing view and an older complete revision', async () => {
    const f = fixture();
    f.projections.find.mockResolvedValue(
      projectEditorialSnapshot(appSnapshot())
    );
    expect(await f.inspect(true)).toMatchObject({
      needsRebuild: 1,
      queued: 1,
      failed: 0,
    });
    expect(f.source.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 2 })
    );
    expect(f.results).toEqual([
      {
        kind: 'app',
        resourceId: editorialId(),
        condition: 'stale',
        queued: true,
      },
    ]);
  });

  it('checks current content fingerprints and leaves a correct projection untouched', async () => {
    const f = fixture();
    f.projections.find.mockResolvedValue(
      projectEditorialSnapshot(appSnapshot({ revision: 2 }))
    );
    expect(await f.inspect(true)).toMatchObject({
      current: 1,
      needsRebuild: 0,
      queued: 0,
    });
    expect(f.source.enqueue).not.toHaveBeenCalled();
  });

  it.each(['ahead', 'tampered', 'wrong-tenant'])(
    'reports %s projections as conflicts without overwriting or silently requeueing them',
    async (condition) => {
      const f = fixture();
      const projection = projectEditorialSnapshot(
        appSnapshot({
          revision: condition === 'ahead' ? 3 : 2,
          tenantId: condition === 'wrong-tenant' ? 'another' : 'default',
        })
      );
      f.projections.find.mockResolvedValue(
        condition === 'tampered'
          ? { ...projection, fingerprint: 'bad' }
          : projection
      );
      expect(await f.inspect(true)).toMatchObject({ conflicts: 1, queued: 0 });
      expect(f.source.enqueue).not.toHaveBeenCalled();
    }
  );

  it('does not misreport a concurrently advanced write as a projection conflict', async () => {
    const f = fixture();
    f.projections.find.mockResolvedValue(
      projectEditorialSnapshot(appSnapshot({ revision: 3 }))
    );
    f.source.current.mockResolvedValue({ ...f.state, revision: 3 });
    expect(await f.inspect(true)).toMatchObject({
      changed: 1,
      conflicts: 0,
      queued: 0,
    });
  });

  it('reports a write that changed after inspection but before the enqueue transaction', async () => {
    const f = fixture();
    f.source.enqueue.mockResolvedValue(false);
    expect(await f.inspect(true)).toMatchObject({ changed: 1, queued: 0 });
  });

  it('continues past an individual failed resource without claiming it was recovered', async () => {
    const f = fixture();
    const second = { ...f.state, resourceId: editorialId(2) };
    f.source.ceiling.mockResolvedValue(second);
    f.source.page
      .mockReset()
      .mockResolvedValueOnce([f.state, second])
      .mockResolvedValue([]);
    f.source.enqueue
      .mockRejectedValueOnce(new Error('SQL lock timeout'))
      .mockResolvedValue(true);
    expect(await rebuildEditorialProjections(f.source)).toMatchObject({
      inspected: 2,
      failed: 1,
      queued: 1,
    });
  });

  it('rejects non-progressing source pages instead of looping forever', async () => {
    const f = fixture();
    f.source.page.mockReset().mockResolvedValue([f.state]);
    await expect(rebuildEditorialProjections(f.source)).rejects.toThrow(
      'cursor progression'
    );
    expect(f.source.enqueue).toHaveBeenCalledTimes(1);
  });
});
