import type { DataSource, EntityManager } from 'typeorm';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { MysqlEditorialWrites } from './mysql-editorial-writes';
import {
  EditorialConflictError,
  EditorialMutation,
  EditorialUnavailableError,
  EditorialValidationError,
} from '../application/editorial.ports';

const id = '019a0010-0000-7000-8000-000000000001';
const mutation: EditorialMutation = {
  type: 'create',
  kind: 'app',
  id,
  at: 100,
  fields: { name: 'App', slug: 'app' },
  previous: null,
  command: {
    actor: {
      identityId: 'owner',
      tenantId: 'default',
      roles: ['editorial:publisher'],
    },
    key: 'key',
    fingerprint: 'hash',
  },
};
const previous = {
  id,
  kind: 'app' as const,
  ownerIdentityId: 'owner',
  tenantId: 'default',
  revision: 1,
  deletedAt: null,
};
const row = {
  resourceKind: 'app',
  resourceId: id,
  ownerIdentityId: 'owner',
  tenantId: 'default',
  revision: '1',
  deletedAt: null,
};
const receipt = {
  fingerprint: 'hash',
  resourceKind: 'app',
  resourceId: id,
  revision: '2',
  deleted: 0,
};

function fixture() {
  const query = jest.fn(
    async (sql: string, _parameters?: unknown[]): Promise<unknown> => {
      void _parameters;
      if (sql.startsWith('SELECT fingerprint')) return [];
      if (sql.startsWith('SELECT resourceKind')) return [row];
      if (sql.startsWith('SELECT id FROM app_records')) return [{ id }];
      return [];
    }
  );
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: async (sql: string, parameters?: unknown[]) => {
      if (sql.startsWith('INSERT INTO identity_erasure_barriers')) return [];
      if (sql.startsWith('SELECT identityId, erasureRevision'))
        return [
          {
            identityId: parameters?.[0],
            erasureRevision: null,
            requestedAt: null,
          },
        ];
      return query(sql, parameters);
    },
  } as unknown as EntityManager;
  const transactions: string[] = [];
  const transaction = jest.fn(
    async (
      _isolation: string,
      callback: (manager: EntityManager) => Promise<unknown>
    ) => {
      transactions.push('begin');
      try {
        const result = await callback(manager);
        transactions.push('commit');
        return result;
      } catch (error) {
        transactions.push('rollback');
        throw error;
      }
    }
  );
  const source = { manager, transaction } as unknown as DataSource;
  return {
    query,
    transaction,
    transactions,
    writes: new MysqlEditorialWrites(source, 'default'),
  };
}

describe('Editorial SQL commit adapter', () => {
  it('stores UTC DATETIME text independently of host and driver timezone', async () => {
    const f = fixture();
    await f.writes.commit({
      ...mutation,
      at: Date.parse('2026-10-25T01:30:00.123Z'),
    });
    const insert = f.query.mock.calls.find(([sql]) =>
      sql.startsWith('INSERT INTO app_records')
    );
    expect(
      insert?.[1]?.filter((value) => value === '2026-10-25 01:30:00.123')
    ).toHaveLength(2);
    expect(insert?.[1]?.some((value) => value instanceof Date)).toBe(false);
  });

  it('commits content, ownership, receipt and outbox through one transaction', async () => {
    const f = fixture();
    await expect(f.writes.commit(mutation)).resolves.toEqual({
      id,
      kind: 'app',
      revision: 1,
      deleted: false,
      projection: 'pending',
    });
    expect(f.transaction).toHaveBeenCalledWith(
      'READ COMMITTED',
      expect.any(Function)
    );
    expect(f.transactions).toEqual(['begin', 'commit']);
    const inserts = f.query.mock.calls
      .filter(([sql]) => sql.startsWith('INSERT'))
      .map(([sql]) => sql.split(' ')[2]);
    expect(inserts).toEqual([
      'app_records',
      'editorial_resource_states',
      'editorial_commands',
      'editorial_outbox',
      'content_update_cursors',
    ]);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO editorial_outbox'),
      ['app', id, 'default', 1, 'create', 'owner', 100, 100]
    );
  });

  it('propagates outbox failure so the transaction rolls back', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql) => {
      if (sql.startsWith('INSERT INTO editorial_outbox'))
        throw new Error('outbox failure');
      return [];
    });
    await expect(f.writes.commit(mutation)).rejects.toThrow('outbox failure');
    expect(f.transactions).toEqual(['begin', 'rollback']);
  });

  it.each([
    { ...row, ownerIdentityId: 'someone-else' },
    { ...row, tenantId: 'other' },
  ])('rechecks access under lock %#', async (changed) => {
    const f = fixture();
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT resourceKind') ? [changed] : original?.(sql, args)
    );
    await expect(
      f.writes.commit({ ...mutation, type: 'update', previous })
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(
      f.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))
    ).toBe(false);
  });

  it.each([
    { ...row, revision: '2' },
    { ...row, deletedAt: 10 },
  ])('rejects concurrent revisions or tombstones %#', async (changed) => {
    const f = fixture();
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT resourceKind') ? [changed] : original?.(sql, args)
    );
    await expect(
      f.writes.commit({ ...mutation, type: 'update', previous })
    ).rejects.toBeInstanceOf(EditorialConflictError);
    expect(
      f.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))
    ).toBe(false);
  });

  it('rechecks a concurrent identical command after acquiring the resource lock', async () => {
    const f = fixture();
    let reads = 0;
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) => {
      if (sql.startsWith('SELECT fingerprint'))
        return ++reads === 1 ? [] : [receipt];
      if (sql.startsWith('SELECT resourceKind'))
        return [{ ...row, revision: '2' }];
      return original?.(sql, args);
    });
    await expect(
      f.writes.commit({ ...mutation, type: 'update', previous })
    ).resolves.toMatchObject({ revision: 2 });
    expect(
      f.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))
    ).toBe(false);
  });

  it('retains content and records a tombstone instead of hard deletion', async () => {
    const f = fixture();
    await expect(
      f.writes.commit({ ...mutation, type: 'delete', fields: {}, previous })
    ).resolves.toMatchObject({ revision: 2, deleted: true });
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('SET revision = ?, deletedAt = ?'),
      [2, 100, 'app', id]
    );
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.startsWith('DELETE FROM app_records')
      )
    ).toBe(false);
  });

  it('rejects an unknown reference before writing anything', async () => {
    const f = fixture();
    await expect(
      f.writes.commit({
        ...mutation,
        fields: { ...mutation.fields, categoryId: id },
      })
    ).rejects.toBeInstanceOf(EditorialValidationError);
    expect(
      f.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE|DELETE)/.test(sql))
    ).toBe(false);
  });

  it('does not allow a category to become its own parent', async () => {
    const f = fixture();
    await expect(
      f.writes.commit({
        ...mutation,
        kind: 'category',
        fields: { name: 'Category', slug: 'category', parentId: id },
      })
    ).rejects.toBeInstanceOf(EditorialValidationError);
  });

  it('replays a concurrent creator after SQL uniqueness resolution', async () => {
    const f = fixture();
    f.transaction.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' })
    );
    const original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql, args) =>
      sql.startsWith('SELECT fingerprint') ? [receipt] : original?.(sql, args)
    );
    await expect(f.writes.commit(mutation)).resolves.toMatchObject({
      id,
      revision: 2,
    });
    f.query.mockResolvedValue([{ ...receipt, fingerprint: 'other' }]);
    await expect(f.writes.commit(mutation)).rejects.toBeInstanceOf(
      EditorialConflictError
    );
  });

  it.each([
    { ...row, ownerIdentityId: 'new-owner' },
    { ...row, tenantId: 'another-tenant' },
  ])(
    'denies receipt replay when authoritative access has changed %#',
    async (changed) => {
      const f = fixture();
      f.query.mockImplementation(async (sql) =>
        sql.startsWith('SELECT fingerprint') ? [receipt] : [changed]
      );
      await expect(f.writes.receipt(mutation.command)).rejects.toBeInstanceOf(
        PermissionDeniedError
      );
      expect(f.transactions).toEqual(['begin', 'rollback']);
      expect(f.query).toHaveBeenLastCalledWith(
        expect.stringContaining('FOR UPDATE'),
        ['app', id]
      );
    }
  );

  it('does not replay a receipt whose authoritative resource is missing', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql) =>
      sql.startsWith('SELECT fingerprint') ? [receipt] : []
    );
    await expect(f.writes.receipt(mutation.command)).rejects.toBeInstanceOf(
      EditorialUnavailableError
    );
  });

  it('turns deadlocks into a retriable unavailable response', async () => {
    const f = fixture();
    f.transaction.mockRejectedValue(
      Object.assign(new Error('deadlock'), { code: 'ER_LOCK_DEADLOCK' })
    );
    await expect(f.writes.commit(mutation)).rejects.toBeInstanceOf(
      EditorialUnavailableError
    );
  });
});
