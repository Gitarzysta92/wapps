import {
  DiscussionProjectionAuthority,
  DiscussionProjectionInspector,
  DiscussionReconciliationSource,
  reconcileDiscussions,
} from './reconciliation';

const authority = (id: string): DiscussionProjectionAuthority => ({
  id,
  tenantId: 'tenant',
  revision: 3,
  nodeCount: 2,
});
function fixture(ids = ['a', 'b', 'c']) {
  const records = ids.map(authority);
  const source: jest.Mocked<DiscussionReconciliationSource> = {
    upperBound: jest.fn().mockResolvedValue(ids[ids.length - 1] ?? ''),
    page: jest
      .fn()
      .mockImplementation(async (after, through, limit) =>
        records
          .filter((record) => record.id > after && record.id <= through)
          .slice(0, limit)
      ),
    current: jest
      .fn()
      .mockImplementation(
        async (id) => records.find((record) => record.id === id) ?? null
      ),
    requeue: jest.fn().mockResolvedValue(true),
  };
  const projections: jest.Mocked<DiscussionProjectionInspector> = {
    inspect: jest.fn().mockResolvedValue('current'),
  };
  return { source, projections };
}

describe('discussion reconciliation', () => {
  it('scans bounded pages through a fixed authoritative upper bound without writing by default', async () => {
    const f = fixture();
    f.projections.inspect
      .mockResolvedValueOnce('missing')
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('incomplete');
    const report = await reconcileDiscussions(f.source, f.projections, {
      batchSize: 2,
    });
    expect(report).toEqual({
      examined: 3,
      current: 0,
      needsRebuild: 3,
      queued: 0,
      changed: 0,
      conflicts: 0,
      failed: 0,
    });
    expect(f.source.page.mock.calls).toEqual([
      ['', 'c', 2],
      ['b', 'c', 2],
    ]);
    expect(f.source.requeue).not.toHaveBeenCalled();
  });

  it('requeues missing/stale/incomplete generations without touching healthy ones', async () => {
    const f = fixture(['a', 'b', 'c', 'd']);
    f.projections.inspect
      .mockResolvedValueOnce('missing')
      .mockResolvedValueOnce('stale')
      .mockResolvedValueOnce('incomplete');
    expect(
      await reconcileDiscussions(f.source, f.projections, { apply: true })
    ).toMatchObject({ examined: 4, current: 1, queued: 3, failed: 0 });
    expect(f.source.requeue.mock.calls.map(([row]) => row.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('does not downgrade a projection that advanced with a concurrent authoritative write', async () => {
    const f = fixture(['a']);
    f.projections.inspect.mockResolvedValue('ahead');
    f.source.current.mockResolvedValue({ ...authority('a'), revision: 4 });
    expect(
      await reconcileDiscussions(f.source, f.projections, { apply: true })
    ).toMatchObject({ changed: 1, conflicts: 0, queued: 0 });
    expect(f.source.requeue).not.toHaveBeenCalled();
  });

  it('reports a projection ahead of unchanged authority and conflicting generations without overwriting', async () => {
    const f = fixture(['a', 'b']);
    f.projections.inspect
      .mockResolvedValueOnce('ahead')
      .mockResolvedValueOnce('conflict');
    expect(
      await reconcileDiscussions(f.source, f.projections, { apply: true })
    ).toMatchObject({ conflicts: 2, queued: 0 });
    expect(f.source.requeue).not.toHaveBeenCalled();
  });

  it('reports source drift during enqueue without claiming the inspected revision was queued', async () => {
    const f = fixture(['a']);
    f.projections.inspect.mockResolvedValue('missing');
    f.source.requeue.mockResolvedValue(false);
    expect(
      await reconcileDiscussions(f.source, f.projections, { apply: true })
    ).toMatchObject({ changed: 1, queued: 0, needsRebuild: 1 });
  });

  it('isolates an unavailable projection and a failed outbox transaction from later aggregates', async () => {
    const f = fixture();
    f.projections.inspect
      .mockRejectedValueOnce(new Error('Mongo unavailable'))
      .mockResolvedValue('missing');
    f.source.requeue.mockRejectedValueOnce(new Error('SQL rollback'));
    const results = jest.fn();
    expect(
      await reconcileDiscussions(f.source, f.projections, {
        apply: true,
        onResult: results,
      })
    ).toMatchObject({ examined: 3, failed: 2, queued: 1 });
    expect(results.mock.calls).toEqual([
      ['a', 'failed', false],
      ['b', 'failed', false],
      ['c', 'missing', true],
    ]);
  });

  it('fails on a nonadvancing page instead of looping forever', async () => {
    const f = fixture();
    f.source.page.mockResolvedValue([authority('a'), authority('a')]);
    await expect(reconcileDiscussions(f.source, f.projections)).rejects.toThrow(
      'page order'
    );
  });

  it('handles an empty authority store without querying projections', async () => {
    const f = fixture([]);
    expect(await reconcileDiscussions(f.source, f.projections)).toMatchObject({
      examined: 0,
      queued: 0,
    });
    expect(f.projections.inspect).not.toHaveBeenCalled();
  });
});
