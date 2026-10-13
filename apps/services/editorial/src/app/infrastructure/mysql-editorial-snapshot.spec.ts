import type { DataSource, EntityManager } from 'typeorm';
import {
  appContent,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import { MysqlEditorialSnapshotReader } from './mysql-editorial-snapshot';

function fixture() {
  const content = appContent();
  const row = {
    name: content.name,
    slug: content.slug,
    createdAtSql: content.createdAtSql,
    updatedAtSql: content.updatedAtSql,
    description: content.description,
    website: content.website,
    isPwa: 0,
    rating: null,
    estimatedNumberOfUsers: null,
    isSuspended: 0,
    logoUrl: null,
    bannerUrl: null,
    categoryId: null,
  };
  const state = {
    tenantId: 'default',
    ownerIdentityId: 'owner',
    revision: '1',
    deletedAt: null,
  };
  const query = jest.fn(
    async (
      sql: string,
      args?: unknown[]
    ): Promise<Record<string, unknown>[]> => {
      void args;
      if (sql.startsWith('SELECT tenantId')) return [state];
      if (sql.startsWith('SELECT name')) return [row];
      return [];
    }
  );
  const outcomes: string[] = [];
  const transaction = jest.fn(
    async (
      _isolation: string,
      run: (manager: EntityManager) => Promise<unknown>
    ) => {
      try {
        const result = await run({ query } as unknown as EntityManager);
        outcomes.push('commit');
        return result;
      } catch (error) {
        outcomes.push('rollback');
        throw error;
      }
    }
  );
  const source = { transaction } as unknown as DataSource;
  return {
    state,
    row,
    query,
    transaction,
    outcomes,
    reader: new MysqlEditorialSnapshotReader(source, 'default'),
  };
}

describe('Editorial authoritative snapshots', () => {
  it('reads metadata, values and all bounded relation lists through one repeatable-read transaction', async () => {
    const f = fixture();
    expect(await f.reader.read('app', editorialId())).toMatchObject({
      revision: 1,
      content: appContent(),
    });
    expect(f.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function)
    );
    expect(
      f.query.mock.calls.filter(([sql]) => sql.includes('LIMIT 51'))
    ).toHaveLength(4);
    expect(
      f.query.mock.calls.some(([sql]) => sql.includes('DATE_FORMAT'))
    ).toBe(true);
    expect(f.outcomes).toEqual(['commit']);
  });

  it('emits only a tombstone when an authoritative resource was deleted', async () => {
    const f = fixture();
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT tenantId')
        ? [{ ...f.state, revision: '2', deletedAt: '100' }]
        : original
        ? original(sql, args)
        : []
    );
    expect(await f.reader.read('app', editorialId())).toMatchObject({
      revision: 2,
      deletedAt: 100,
      content: null,
    });
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it('refuses missing values instead of creating an empty successful view', async () => {
    const f = fixture();
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT name') ? [] : original ? original(sql, args) : []
    );
    await expect(f.reader.read('app', editorialId())).rejects.toThrow(
      'Missing authoritative'
    );
    expect(f.outcomes).toEqual(['rollback']);
  });

  it.each([
    { tenantId: 'other', deletedAt: null, foundId: editorialId(2) },
    { tenantId: 'default', deletedAt: 100, foundId: editorialId(2) },
    { tenantId: 'default', deletedAt: null, foundId: null },
  ])('rejects unavailable or cross-tenant references %#', async (reference) => {
    const f = fixture();
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.includes('FROM app_record_tags')
        ? [{ id: editorialId(2), ...reference }]
        : original
        ? original(sql, args)
        : []
    );
    await expect(f.reader.read('app', editorialId())).rejects.toThrow();
  });

  it('bounds oversized source relation sets before publication', async () => {
    const f = fixture();
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.includes('FROM app_record_tags')
        ? Array.from({ length: 51 }, () => ({ id: editorialId(2) }))
        : original
        ? original(sql, args)
        : []
    );
    await expect(f.reader.read('app', editorialId())).rejects.toThrow(
      'count exceeds'
    );
  });

  it('detects cyclic category ancestry in the same source snapshot', async () => {
    const f = fixture();
    const content = appContent();
    f.query.mockImplementation(async (sql) => {
      if (sql.startsWith('SELECT tenantId')) return [f.state];
      if (sql.startsWith('SELECT name'))
        return [
          {
            name: 'Category',
            slug: 'category',
            createdAtSql: content.createdAtSql,
            updatedAtSql: content.updatedAtSql,
            parentId: editorialId(2),
          },
        ];
      return [
        { parentId: editorialId(), tenantId: 'default', deletedAt: null },
      ];
    });
    await expect(f.reader.read('category', editorialId())).rejects.toThrow(
      'cyclic'
    );
  });

  it('never claims ownership for an unbackfilled legacy row', async () => {
    const f = fixture();
    f.query.mockResolvedValue([]);
    await expect(f.reader.read('app', editorialId())).rejects.toThrow(
      'Versioned Editorial resource is unavailable'
    );
    expect(f.query).toHaveBeenCalledTimes(1);
  });

  it.each([64, 65])(
    'enforces the category traversal bound for an app with %i ancestors',
    async (depth) => {
      const f = fixture();
      const original = f.query.getMockImplementation();
      const parents = Array.from({ length: depth }, (_, index) =>
        editorialId(index + 2)
      );
      f.query.mockImplementation(async (sql, args) => {
        if (sql.startsWith('SELECT name'))
          return [{ ...f.row, categoryId: parents[0] }];
        if (sql.includes('FROM categories c')) {
          const index = parents.indexOf(String(args?.[0]));
          return [
            {
              parentId: parents[index + 1] ?? null,
              tenantId: 'default',
              deletedAt: null,
            },
          ];
        }
        return original ? original(sql, args) : [];
      });
      if (depth === 64)
        await expect(
          f.reader.read('app', editorialId())
        ).resolves.toMatchObject({ content: { categoryId: parents[0] } });
      else
        await expect(f.reader.read('app', editorialId())).rejects.toThrow(
          'excessive'
        );
    }
  );
});
