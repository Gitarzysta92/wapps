import type { DataSource, EntityManager } from 'typeorm';
import { MysqlEditorialOutbox } from './mysql-editorial-outbox';

function fixture() {
  const query = jest.fn().mockResolvedValue([]);
  const manager = { query } as unknown as EntityManager;
  const transaction = jest.fn(
    async (_isolation: string, run: (tx: EntityManager) => Promise<unknown>) =>
      run(manager)
  );
  const source = { transaction, query } as unknown as DataSource;
  return { query, transaction, outbox: new MysqlEditorialOutbox(source) };
}

describe('Editorial SQL outbox leasing', () => {
  it('requeues only an explicitly selected failed request without interfering with live leases', async () => {
    const f = fixture();
    f.query.mockResolvedValue({ affectedRows: 1 });
    expect(await f.outbox.requeueFailed('7', 100)).toBe(true);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('failedAt IS NOT NULL AND deliveredAt IS NULL'),
      [100, '7', 100]
    );
    expect(f.query.mock.calls[0][0]).toContain('leasedUntil < ?');
    f.query.mockResolvedValue({ affectedRows: 0 });
    expect(await f.outbox.requeueFailed('7', 100)).toBe(false);
  });

  it('rejects broad or injected requeue identifiers before touching SQL', async () => {
    const f = fixture();
    await expect(f.outbox.requeueFailed('all', 100)).rejects.toThrow(
      'positive SQL outbox ID'
    );
    expect(f.query).not.toHaveBeenCalled();
  });
  it('claims one due unfailed request under a skip-locked transaction with an expiring token', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([{ id: 7, attempts: 0 }]);
    expect(await f.outbox.claim(100, 'token')).toMatchObject({ id: '7' });
    expect(f.transaction).toHaveBeenCalledWith(
      'READ COMMITTED',
      expect.any(Function)
    );
    expect(f.query.mock.calls[0][0]).toContain('failedAt IS NULL');
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET leaseToken = ?, leasedUntil = ?'),
      ['token', 30100, 7]
    );
  });

  it('does not create a lease when no request is due', async () => {
    const f = fixture();
    expect(await f.outbox.claim(100, 'token')).toBeNull();
    expect(f.query).toHaveBeenCalledTimes(1);
  });

  it('fences delivery marking and distinguishes a replaced lease', async () => {
    const f = fixture();
    f.query.mockResolvedValue({ affectedRows: 0 });
    expect(await f.outbox.delivered('1', 'stale-token', 100)).toBe(false);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ? AND leaseToken = ?'),
      [100, '1', 'stale-token']
    );
    f.query.mockResolvedValue({ affectedRows: 1 });
    expect(await f.outbox.delivered('1', 'current-token', 100)).toBe(true);
  });

  it('retains failures without changing a delivered or newly leased request', async () => {
    const f = fixture();
    await f.outbox.failed('1', 'token', 12, 1000, 100);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('AND deliveredAt IS NULL AND failedAt IS NULL'),
      [12, 1000, 100, '1', 'token']
    );
    expect(f.query.mock.calls[0][0]).not.toContain('DELETE');
  });
});
