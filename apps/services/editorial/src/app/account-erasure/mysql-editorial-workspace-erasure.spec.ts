import type { DataSource, EntityManager } from 'typeorm';
import { MysqlEditorialWorkspaceErasure } from './mysql-editorial-workspace-erasure';

const request = { identityId: 'ErasedAuthor', revision: 7 };
function fixture(table: string, extra: Record<string, unknown> = {}) {
  const draft = {
    id: '00000000-0000-4000-8000-000000000001',
    ownerIdentityId: request.identityId,
    tenantId: 'default',
    revision: 1,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...extra,
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM identity_erasure_barriers'))
      return [
        {
          identityId: request.identityId,
          erasureRevision: 7,
          requestedAt: 100,
        },
      ];
    if (sql.includes('FROM identity_erasure_requests'))
      return [{ revision: 7, requestedAt: 100, completedAt: null }];
    if (sql.includes(`FROM ${table} WHERE ownerIdentityId`)) return [draft];
    if (sql.startsWith('SELECT')) return [];
    return { affectedRows: 0 };
  });
  const manager = { query, queryRunner: { isTransactionActive: true } };
  const source = {
    transaction: async (
      _isolation: string,
      run: (manager: EntityManager) => Promise<unknown>
    ) => run(manager as unknown as EntityManager),
  };
  return {
    query,
    worker: new MysqlEditorialWorkspaceErasure(
      source as unknown as DataSource,
      () => 101
    ),
  };
}

describe('Editorial erasure draft lifecycle', () => {
  it.each(['private_suites', 'article_drafts', 'release_drafts'])(
    'erases a valid epoch-created draft in %s',
    async (table) => {
      const f = fixture(table);
      await expect(f.worker.advance(request)).resolves.toBe('pending');
      expect(f.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE ${table} SET`),
        [2, 101, 101, '00000000-0000-4000-8000-000000000001']
      );
    }
  );
  it('also removes an epoch tombstone without treating zero as absence', async () => {
    const f = fixture('private_suites', { deletedAt: 0 });
    await expect(f.worker.advance(request)).resolves.toBe('pending');
    expect(f.query).toHaveBeenCalledWith(
      'DELETE FROM private_suites WHERE id=?',
      ['00000000-0000-4000-8000-000000000001']
    );
  });
  it.each([
    ['application_drafts', { createdAt: 0, updatedAt: 1 }],
    ['private_suites', { createdAt: -1 }],
    ['article_drafts', { createdAt: 2, updatedAt: 1 }],
    ['release_drafts', { updatedAt: 2, deletedAt: 1 }],
  ])('rejects invalid authority before changing %s', async (table, extra) => {
    const f = fixture(table as string, extra as Record<string, unknown>);
    await expect(f.worker.advance(request)).rejects.toThrow();
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
});
