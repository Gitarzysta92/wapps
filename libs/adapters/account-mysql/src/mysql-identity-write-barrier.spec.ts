import type { EntityManager } from 'typeorm';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} from '@sdk/features/identity/core';
import {
  beginIdentityErasure,
  identityErasureBarrier,
  lockIdentityWrites,
  lockIdentityWriteRecipients,
} from './mysql-identity-write-barrier';

function fixture(erased = false) {
  const query = jest.fn(async (sql: string, parameters: unknown[]) =>
    sql.startsWith('SELECT')
      ? [
          {
            identityId: parameters[0],
            erasureRevision: erased ? '4' : null,
            requestedAt: erased ? '100' : null,
          },
        ]
      : []
  );
  const manager = {
    queryRunner: { isTransactionActive: true },
    query,
  } as unknown as EntityManager;
  return { manager, query };
}

describe('Canonical identity write barrier', () => {
  it('locks mixed required writers and optional recipients in one global order', async () => {
    const { manager, query } = fixture();
    expect(
      await lockIdentityWriteRecipients(manager, ['z'], ['a', 'z'])
    ).toEqual(['a', 'z']);
    expect(query.mock.calls.map(([, parameters]) => parameters)).toEqual([
      ['a'],
      ['a'],
      ['z'],
      ['z'],
    ]);
  });
  it('omits erased recipients while preserving the valid peer write', async () => {
    const { manager, query } = fixture();
    query.mockImplementation(async (sql, parameters) =>
      sql.startsWith('SELECT')
        ? [
            {
              identityId: parameters[0],
              erasureRevision: parameters[0] === 'recipient' ? '4' : null,
              requestedAt: parameters[0] === 'recipient' ? '100' : null,
            },
          ]
        : []
    );
    expect(
      await lockIdentityWriteRecipients(manager, ['writer'], ['recipient'])
    ).toEqual([]);
    await expect(
      lockIdentityWriteRecipients(manager, ['recipient'], ['writer'])
    ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
    await expect(
      lockIdentityWriteRecipients(manager, [], ['writer'])
    ).rejects.toThrow('required writer');
  });
  it('locks distinct identities in a consistent order before the caller can write', async () => {
    const { manager, query } = fixture();
    await lockIdentityWrites(manager, ['z', 'a', 'z']);
    expect(query.mock.calls.map(([, parameters]) => parameters)).toEqual([
      ['a'],
      ['a'],
      ['z'],
      ['z'],
    ]);
    expect(
      query.mock.calls.filter(([sql]) => sql.includes('FOR UPDATE'))
    ).toHaveLength(2);
  });

  it('rejects autocommit access before any database work', async () => {
    const { manager, query } = fixture();
    const inactive = {
      ...manager,
      queryRunner: { isTransactionActive: false },
    } as unknown as EntityManager;
    await expect(lockIdentityWrites(inactive, ['owner'])).rejects.toThrow(
      'active transaction'
    );
    expect(query).not.toHaveBeenCalled();
  });

  it.each(
    [[], [''], [' owner'], Array<string>(9).fill('owner')].map(
      (identities) => ({ identities })
    )
  )('rejects invalid or unbounded scope %j', async ({ identities }) => {
    const { manager, query } = fixture();
    await expect(lockIdentityWrites(manager, identities)).rejects.toThrow(
      'Invalid identity write scope'
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('denies writes and receipt replay after erasure', async () => {
    const { manager } = fixture(true);
    await expect(lockIdentityWrites(manager, ['owner'])).rejects.toBeInstanceOf(
      CanonicalIdentityAccessDenied
    );
  });

  it('commits the original canonical deletion revision and start time', async () => {
    const { manager, query } = fixture();
    await expect(
      beginIdentityErasure(manager, 'owner', 4, 100)
    ).resolves.toEqual({
      identityId: 'owner',
      erasureRevision: 4,
      requestedAt: 100,
    });
    expect(query.mock.calls[query.mock.calls.length - 1][1]).toEqual([
      4,
      100,
      'owner',
    ]);
  });

  it('replays the original barrier without moving its cutoff', async () => {
    const { manager, query } = fixture(true);
    await expect(
      beginIdentityErasure(manager, 'owner', 4, 200)
    ).resolves.toEqual({
      identityId: 'owner',
      erasureRevision: 4,
      requestedAt: 100,
    });
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
      false
    );
    await expect(
      beginIdentityErasure(manager, 'owner', 5, 200)
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
  });

  it.each([
    { identityId: 'owner', erasureRevision: null, requestedAt: 1 },
    { identityId: 'owner', erasureRevision: 1, requestedAt: null },
    {
      identityId: 'owner',
      erasureRevision: '9007199254740992',
      requestedAt: 1,
    },
    { identityId: 'owner', erasureRevision: 0, requestedAt: 1 },
    { identityId: 'owner', erasureRevision: 1.5, requestedAt: 1 },
    { identityId: '', erasureRevision: null, requestedAt: null },
  ])('fails closed for malformed authority %j', (row) => {
    expect(() => identityErasureBarrier(row)).toThrow();
  });
});
