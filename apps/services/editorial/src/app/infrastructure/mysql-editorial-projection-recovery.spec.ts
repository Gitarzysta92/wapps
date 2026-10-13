import type { DataSource, EntityManager } from 'typeorm';
import { editorialId } from '../../testing/editorial-projection-fixtures';
import { MysqlEditorialProjectionRecovery } from './mysql-editorial-projection-recovery';

const resource = {
  kind: 'app' as const,
  resourceId: editorialId(),
  tenantId: 'default',
  revision: 2,
  deletedAt: null,
};

function fixture() {
  const query = jest.fn().mockResolvedValue([{ ...resource, revision: '2' }]);
  const manager = { query } as unknown as EntityManager;
  const transaction = jest.fn(
    async (_isolation: string, run: (tx: EntityManager) => Promise<unknown>) =>
      run(manager)
  );
  const source = { query, manager, transaction } as unknown as DataSource;
  return {
    query,
    transaction,
    recovery: new MysqlEditorialProjectionRecovery(source, () => 100),
  };
}

describe('Editorial SQL recovery scheduling', () => {
  it('rechecks the authoritative revision under lock and creates an idempotent current request without old event history', async () => {
    const f = fixture();
    expect(await f.recovery.enqueue(resource)).toBe(true);
    expect(f.transaction).toHaveBeenCalledWith(
      'READ COMMITTED',
      expect.any(Function)
    );
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO editorial_outbox'),
      ['app', editorialId(), 'default', 2, 100, 100]
    );
    expect(f.query.mock.calls[1][0]).toContain(
      'ON DUPLICATE KEY UPDATE deliveredAt = NULL, failedAt = NULL'
    );
    expect(f.query.mock.calls[1][0]).toContain('leaseToken = NULL');
    expect(
      f.query.mock.calls.some(
        ([sql]) => sql.startsWith('SELECT') && sql.includes('editorial_outbox')
      )
    ).toBe(false);
  });

  it.each([{ revision: '3' }, { tenantId: 'other' }, { deletedAt: 100 }])(
    'does not requeue an inspection superseded by a concurrent mutation %#',
    async (change) => {
      const f = fixture();
      f.query.mockResolvedValue([{ ...resource, ...change }]);
      expect(await f.recovery.enqueue(resource)).toBe(false);
      expect(f.query).toHaveBeenCalledTimes(1);
    }
  );

  it('uses bounded keyset pages and never excludes tombstones', async () => {
    const f = fixture();
    expect(await f.recovery.page(null, resource, 100)).toEqual([resource]);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY resourceKind, resourceId LIMIT ?'),
      ['', '', '', 'app', 'app', editorialId(), 100]
    );
    expect(f.query.mock.calls[0][0]).not.toContain('deletedAt IS NULL');
  });

  it('rejects unbounded page requests before SQL execution', async () => {
    const f = fixture();
    await expect(f.recovery.page(null, resource, 101)).rejects.toThrow(
      'page limit'
    );
    expect(f.query).not.toHaveBeenCalled();
  });
});
