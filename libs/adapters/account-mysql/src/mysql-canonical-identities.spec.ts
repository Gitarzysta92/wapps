import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import { MysqlCanonicalIdentities } from './mysql-canonical-identities';

const row = {
  id: '00000000-0000-4000-8000-000000000001',
  identity_id: 'Uid',
  claim: 'Uid',
  kind: 'user',
  provider_type: 'email',
  is_active: 1,
  is_suspended: 0,
  is_deleted: 0,
  revision: '1',
  created_at: '100',
  updated_at: '100',
  deleted_at: '0',
};
const profile = {
  name: 'Alice',
  bio: null,
  location: null,
  avatarUri: null,
  expectedRevision: 1,
};

function fixture() {
  const query = jest.fn();
  const outside = jest.fn();
  const transaction = jest.fn(
    async (
      _isolation: string,
      run: (manager: EntityManager) => Promise<unknown>
    ) => run({ query } as unknown as EntityManager)
  );
  const source = {
    transaction,
    manager: { query: outside },
  } as unknown as DataSource;
  return {
    query,
    outside,
    transaction,
    store: new MysqlCanonicalIdentities(source, () => 200, randomUUID),
  };
}

describe('canonical identity authority', () => {
  it.each([
    [null, null, null, null, 'pending'],
    [210, null, null, null, 'pending'],
    [null, null, 210, null, 'pending'],
    [210, null, 220, null, 'completed'],
    [null, 210, null, null, 'failed'],
    [210, null, null, 220, 'failed'],
  ])(
    'reads combined cleanup state without modifying journals',
    async (
      completedAt,
      failedAt,
      erasureCompletedAt,
      erasureFailedAt,
      cleanup
    ) => {
      const f = fixture();
      f.query
        .mockResolvedValueOnce([
          { ...row, is_active: 0, is_deleted: 1, deleted_at: 100 },
        ])
        .mockResolvedValueOnce([
          {
            revision: 1,
            erasureRevision: 1,
            completedAt,
            failedAt,
            erasureCompletedAt,
            erasureFailedAt,
          },
        ]);
      expect(await f.store.findDeletion('Uid')).toMatchObject({
        identityId: 'Uid',
        revision: 1,
        cleanup,
      });
      expect(
        f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
      ).toBe(true);
    }
  );

  it.each([{ rows: [] }, { rows: [row] }])(
    'does not start deletion while reading an absent or active identity',
    async ({ rows }) => {
      const f = fixture();
      f.query.mockResolvedValueOnce(rows);
      expect(await f.store.findDeletion('Uid')).toBeNull();
      expect(f.query).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    [],
    [
      {
        revision: 1,
        erasureRevision: null,
        completedAt: 210,
        failedAt: null,
        erasureCompletedAt: null,
        erasureFailedAt: null,
      },
    ],
    [
      {
        revision: 1,
        erasureRevision: 2,
        completedAt: 210,
        failedAt: null,
        erasureCompletedAt: 220,
        erasureFailedAt: null,
      },
    ],
    [
      {
        revision: 1,
        erasureRevision: 1,
        completedAt: 210,
        failedAt: 220,
        erasureCompletedAt: null,
        erasureFailedAt: null,
      },
    ],
  ])(
    'fails closed on missing or inconsistent cleanup journals',
    async (...jobs) => {
      const f = fixture();
      f.query
        .mockResolvedValueOnce([
          { ...row, is_active: 0, is_deleted: 1, deleted_at: 100 },
        ])
        .mockResolvedValueOnce(jobs);
      await expect(f.store.findDeletion('Uid')).rejects.toThrow();
      expect(
        f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
      ).toBe(true);
    }
  );

  const update = {
    name: 'Edited',
    bio: 'Bio',
    location: null,
    socialLinks: { github: '@alice' },
    expectedRevision: 1,
  };
  it('cannot overwrite a registered profile through initial registration', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ identityId: 'Uid' }]);
    await expect(
      f.store.completeRegistration('Uid', profile, 'new-key')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
    expect(f.query).toHaveBeenCalledTimes(3);
  });
  it('commits profile text, revision, retry receipt and invalidation together without replacing media', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    expect(await f.store.updateProfile('Uid', update, 'edit')).toEqual({
      identityId: 'Uid',
      revision: 2,
    });
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(
      f.query.mock.calls[2][0].split('ON DUPLICATE KEY UPDATE')[1]
    ).not.toContain('avatarUri');
    expect(f.query.mock.calls[2][1]).toEqual([
      'Uid',
      'Edited',
      'Bio',
      null,
      '{"github":"@alice"}',
      200,
      200,
    ]);
    expect(f.query.mock.calls[4][0]).toContain('identity_account_commands');
    const event = JSON.parse(f.query.mock.calls[5][1][4]);
    expect(event.payload).toMatchObject({ identityId: 'Uid', revision: 2 });
    expect(JSON.stringify(event)).not.toContain('Edited');
    expect(f.outside).not.toHaveBeenCalled();
  });
  it('replays a profile command without replacing later content, then rejects a different intent with the same key', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    await f.store.updateProfile('Uid', update, 'edit');
    const receipt = { fingerprint: f.query.mock.calls[4][1][2], revision: 2 };
    f.query
      .mockReset()
      .mockResolvedValueOnce([{ ...row, revision: 7 }])
      .mockResolvedValueOnce([receipt]);
    expect(await f.store.updateProfile('Uid', update, 'edit')).toEqual({
      identityId: 'Uid',
      revision: 2,
    });
    expect(f.query).toHaveBeenCalledTimes(2);
    f.query
      .mockReset()
      .mockResolvedValueOnce([{ ...row, revision: 7 }])
      .mockResolvedValueOnce([receipt]);
    await expect(
      f.store.updateProfile('Uid', { ...update, name: 'Other' }, 'edit')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
  });
  it('rejects stale profile commands and rechecks lifecycle before receipt replay', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([{ ...row, revision: 7 }])
      .mockResolvedValueOnce([]);
    await expect(
      f.store.updateProfile('Uid', update, 'edit')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
    expect(f.query).toHaveBeenCalledTimes(2);
    f.query.mockReset().mockResolvedValueOnce([{ ...row, is_suspended: 1 }]);
    await expect(
      f.store.updateProfile('Uid', update, 'edit')
    ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
    expect(f.query).toHaveBeenCalledTimes(1);
  });
  it('does not acknowledge a profile command whose outbox insert fails', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT id,')) return [row];
      if (sql.startsWith('SELECT')) return [];
      if (sql.includes('identity_events_outbox'))
        throw new Error('outbox failed');
      return { affectedRows: 1 };
    });
    await expect(f.store.updateProfile('Uid', update, 'edit')).rejects.toThrow(
      'outbox failed'
    );
  });
  it('reads a consistent private snapshot and rejects corrupt stored social links', async () => {
    const f = fixture();
    const stored = {
      name: 'Alice',
      bio: null,
      location: null,
      contactEmail: null,
      avatarUri: null,
      socialLinks: null,
      registeredAt: 100,
      updatedAt: 100,
    };
    f.query.mockResolvedValueOnce([row]).mockResolvedValueOnce([stored]);
    expect(await f.store.getProfile('Uid')).toMatchObject({
      identityId: 'Uid',
      revision: 1,
      profile: { socialLinks: {} },
    });
    expect(f.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function)
    );
    f.query
      .mockReset()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([
        { ...stored, socialLinks: '{"website":"javascript:bad"}' },
      ]);
    await expect(f.store.getProfile('Uid')).rejects.toThrow(
      'Invalid stored profile'
    );
  });
  it('initial enrollment commits profile, revision, receipt and outbox under the identity lock', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([{ ...row, revision: 7 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    expect(await f.store.enrollAccount('Uid', 'Alice', 'enroll-1')).toEqual({
      identityId: 'Uid',
      revision: 8,
      registered: true,
    });
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(f.query.mock.calls[3][0]).not.toContain('DUPLICATE');
    expect(f.query.mock.calls[3][1]).toEqual(['Uid', 'Alice', 200, 200]);
    expect(f.query.mock.calls[5][0]).toContain('identity_account_commands');
    expect(JSON.parse(f.query.mock.calls[6][1][4]).payload).toMatchObject({
      identityId: 'Uid',
      revision: 8,
    });
    expect(f.outside).not.toHaveBeenCalled();
  });
  it('replaying initial enrollment preserves a subsequently edited profile', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    await f.store.enrollAccount('Uid', 'Alice', 'enroll-1');
    const fingerprint = f.query.mock.calls[5][1][2];
    f.query
      .mockReset()
      .mockResolvedValueOnce([{ ...row, revision: 9 }])
      .mockResolvedValueOnce([{ fingerprint, revision: 2 }]);
    expect(
      await f.store.enrollAccount('Uid', 'Alice', 'enroll-1')
    ).toMatchObject({ revision: 2 });
    expect(f.query).toHaveBeenCalledTimes(2);
  });
  it('never overwrites an existing profile with a new enrollment command', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ identityId: 'Uid' }]);
    await expect(
      f.store.enrollAccount('Uid', 'Alice', 'new-key')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
    expect(f.query).toHaveBeenCalledTimes(3);
  });
  it('does not confuse initial enrollment with profile-edit receipts', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    await f.store.completeRegistration('Uid', profile, 'shared-key');
    const fingerprint = f.query.mock.calls[5][1][2];
    f.query
      .mockReset()
      .mockResolvedValueOnce([{ ...row, revision: 2 }])
      .mockResolvedValueOnce([{ fingerprint, revision: 2 }]);
    await expect(
      f.store.enrollAccount('Uid', 'Alice', 'shared-key')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
  });
  it('enrollment replay checks current lifecycle before looking up receipts', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([{ ...row, is_suspended: 1 }]);
    await expect(
      f.store.enrollAccount('Uid', 'Alice', 'enroll-1')
    ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
    expect(f.query).toHaveBeenCalledTimes(1);
  });
  it('does not acknowledge enrollment if its durable event fails', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT id,')) return [row];
      if (sql.startsWith('SELECT')) return [];
      if (sql.includes('identity_events_outbox'))
        throw new Error('outbox unavailable');
      return { affectedRows: 1 };
    });
    await expect(
      f.store.enrollAccount('Uid', 'Alice', 'enroll-1')
    ).rejects.toThrow('outbox unavailable');
  });
  it.each([
    [' ', 'key'],
    ['Alice\nBob', 'key'],
    ['Alice', ''],
    ['Alice', 'bad key'],
  ])('validates initial enrollment before SQL', async (name, key) => {
    const f = fixture();
    await expect(
      f.store.enrollAccount('Uid', name, key)
    ).rejects.toBeInstanceOf(CanonicalIdentityInputError);
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('creates the UID, subject and durable created event in the same transaction', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([]).mockResolvedValue({ affectedRows: 1 });
    const result = await f.store.ensure({
      uid: 'Uid',
      provider: 'email',
      kind: 'user',
      activate: true,
    });
    expect(result.created).toBe(true);
    expect(result.state.identityId).toBe('Uid');
    expect(result.state.subjectId).not.toBe('Uid');
    expect(f.transaction).toHaveBeenCalledWith(
      'READ COMMITTED',
      expect.any(Function)
    );
    expect(f.query.mock.calls[1][1]).toEqual([
      result.state.subjectId,
      'Uid',
      'Uid',
      'user',
      'email',
      true,
      200,
      200,
    ]);
    const body = JSON.parse(f.query.mock.calls[2][1][4]);
    expect(body.payload).toMatchObject({
      identityId: 'Uid',
      subjectId: result.state.subjectId,
      revision: 1,
    });
    expect(f.outside).not.toHaveBeenCalled();
  });

  it.each([
    { is_suspended: 1 },
    { is_active: 0 },
    { is_active: 0, is_deleted: 1, deleted_at: '100' },
  ])('preserves existing restrictions on provisioning: %j', async (patch) => {
    const f = fixture();
    f.query.mockResolvedValue([{ ...row, ...patch }]);
    const result = await f.store.ensure({
      uid: 'Uid',
      provider: 'google',
      kind: 'user',
      activate: true,
    });
    expect(result.created).toBe(false);
    expect(result.state.provider).toBe('email');
    expect(f.query).toHaveBeenCalledTimes(1);
  });

  it('converges after a duplicate first provision by reading committed authority', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });
    f.outside.mockResolvedValue([{ ...row, is_suspended: 1 }]);
    expect(
      await f.store.ensure({
        uid: 'Uid',
        provider: 'email',
        kind: 'user',
        activate: true,
      })
    ).toMatchObject({
      created: false,
      state: { identityId: 'Uid', isSuspended: true },
    });
  });

  it('never converts database failure into an absent identity', async () => {
    const f = fixture();
    f.outside.mockRejectedValue(new Error('offline'));
    await expect(f.store.find('Uid')).rejects.toThrow('offline');
  });

  it('refuses a database collation that returns a different principal', async () => {
    const f = fixture();
    f.outside.mockResolvedValue([row]);
    await expect(f.store.find('uid')).rejects.toThrow('case-sensitive');
  });

  it.each([
    { updated_at: '90' },
    { revision: '9007199254740992' },
    { is_active: 2 },
    { is_deleted: 1 },
    { deleted_at: '1' },
  ])('rejects corrupt lifecycle data: %j', async (patch) => {
    const f = fixture();
    f.outside.mockResolvedValue([{ ...row, ...patch }]);
    await expect(f.store.find('Uid')).rejects.toThrow();
  });

  it('does not authenticate an identity suspended after credential validation', async () => {
    const f = fixture();
    f.query.mockResolvedValue([{ ...row, is_suspended: 1 }]);
    await expect(
      f.store.recordAuthentication('Uid', 'email')
    ).rejects.toThrow();
    expect(f.query).toHaveBeenCalledTimes(1);
  });

  it('fails provisioning if its durable event cannot be committed', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockRejectedValueOnce(new Error('outbox failed'));
    await expect(
      f.store.ensure({
        uid: 'Uid',
        provider: 'email',
        kind: 'user',
        activate: true,
      })
    ).rejects.toThrow('outbox failed');
  });

  it('commits profile, new revision, receipt and event through one locked transaction', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    expect(
      await f.store.completeRegistration('Uid', profile, 'command-1')
    ).toEqual({ identityId: 'Uid', revision: 2, registered: true });
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(
      f.query.mock.calls.slice(3).map((call) => call[0].split(' ')[2])
    ).toEqual([
      'identity_accounts',
      'SET',
      'identity_account_commands',
      'identity_events_outbox',
    ]);
    expect(f.outside).not.toHaveBeenCalled();
  });

  it('replays an identical command without overwriting later edits', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    await f.store.completeRegistration('Uid', profile, 'command-1');
    const fingerprint = f.query.mock.calls[5][1][2];
    f.query
      .mockReset()
      .mockResolvedValueOnce([{ ...row, revision: '8' }])
      .mockResolvedValueOnce([{ fingerprint, revision: '2' }]);
    expect(
      await f.store.completeRegistration('Uid', profile, 'command-1')
    ).toMatchObject({ revision: 2 });
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it('rejects reuse of a receipt for another payload', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ fingerprint: 'different', revision: '2' }]);
    await expect(
      f.store.completeRegistration('Uid', profile, 'command-1')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it('rejects stale expected revisions without writing', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([{ ...row, revision: 2 }])
      .mockResolvedValueOnce([]);
    await expect(
      f.store.completeRegistration('Uid', profile, 'command-2')
    ).rejects.toBeInstanceOf(CanonicalIdentityConflict);
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it('checks current access before replaying an old registration receipt', async () => {
    const f = fixture();
    f.query.mockResolvedValue([
      { ...row, is_active: 0, is_deleted: 1, deleted_at: 100 },
    ]);
    await expect(
      f.store.completeRegistration('Uid', profile, 'command-1')
    ).rejects.toBeInstanceOf(CanonicalIdentityAccessDenied);
    expect(f.query).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: ' ' },
    { expectedRevision: '1' },
    { avatarUri: 'not a url' },
    { avatarUri: 'https://user:password@example.com' },
    { avatarUri: 'https://example.com/a\nb' },
    { name: 'Alice\nBob' },
    { location: '\u0000' },
    { bio: 'x'.repeat(501) },
  ])('validates registration before database access: %j', async (patch) => {
    const f = fixture();
    await expect(
      f.store.completeRegistration(
        'Uid',
        { ...profile, ...patch } as typeof profile,
        'command-1'
      )
    ).rejects.toBeInstanceOf(CanonicalIdentityInputError);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it('atomically tombstones, erases private profile, schedules cleanup and records deletion', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]).mockResolvedValue({ affectedRows: 1 });
    expect(await f.store.requestDeletion('Uid')).toMatchObject({
      identityId: 'Uid',
      revision: 2,
      isActive: false,
      isDeleted: true,
      deletedAt: 200,
    });
    expect(f.query.mock.calls[2]).toEqual([
      'DELETE FROM identity_profile_avatars WHERE identityId = ?',
      ['Uid'],
    ]);
    expect(f.query.mock.calls[3]).toEqual([
      'DELETE FROM identity_profile_follow_commands WHERE ownerId = ? OR requesterId = ?',
      [row.id, row.id],
    ]);
    expect(f.query.mock.calls[4]).toEqual([
      'DELETE FROM identity_profile_follows WHERE ownerId = ? OR requesterId = ?',
      [row.id, row.id],
    ]);
    expect(f.query.mock.calls[5]).toEqual([
      'DELETE FROM identity_accounts WHERE identityId = ?',
      ['Uid'],
    ]);
    expect(f.query.mock.calls[6]).toEqual([
      'DELETE FROM identity_preferences WHERE identityId = ?',
      ['Uid'],
    ]);
    expect(f.query.mock.calls[7]).toEqual([
      'DELETE FROM identity_favorite_watches WHERE identityId=?',
      ['Uid'],
    ]);
    expect(f.query.mock.calls[8]).toEqual([
      'DELETE FROM identity_favorites WHERE identityId = ?',
      ['Uid'],
    ]);
    expect(f.query.mock.calls[9][0]).toContain(
      'INSERT INTO identity_deletion_jobs'
    );
    expect(
      JSON.parse(f.query.mock.calls[11][1][4]).payload.state.isDeleted
    ).toBe(true);
  });

  it('repeated deletion never regenerates cleanup or erases history', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([
        { ...row, revision: 2, is_active: 0, is_deleted: 1, deleted_at: 100 },
      ])
      .mockResolvedValueOnce([
        {
          revision: 2,
          completedAt: 150,
          failedAt: null,
          erasureRevision: 2,
          erasureCompletedAt: 160,
          erasureFailedAt: null,
        },
      ]);
    expect(await f.store.requestDeletion('Uid')).toMatchObject({
      revision: 2,
      cleanup: 'completed',
    });
    expect(f.query).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      completedAt: 150,
      failedAt: null,
      erasureCompletedAt: null,
      erasureFailedAt: null,
      expected: 'pending',
    },
    {
      completedAt: null,
      failedAt: null,
      erasureCompletedAt: 150,
      erasureFailedAt: null,
      expected: 'pending',
    },
    {
      completedAt: 150,
      failedAt: null,
      erasureCompletedAt: null,
      erasureFailedAt: 160,
      expected: 'failed',
    },
    {
      completedAt: null,
      failedAt: 150,
      erasureCompletedAt: 160,
      erasureFailedAt: null,
      expected: 'failed',
    },
  ])(
    'requires both cleanup journals before reporting completion: %j',
    async ({ expected, ...status }) => {
      const f = fixture();
      f.query
        .mockResolvedValueOnce([
          { ...row, revision: 2, is_active: 0, is_deleted: 1, deleted_at: 100 },
        ])
        .mockResolvedValueOnce([
          { revision: 2, erasureRevision: 2, ...status },
        ]);
      expect(await f.store.requestDeletion('Uid')).toMatchObject({
        cleanup: expected,
      });
      expect(f.query).toHaveBeenCalledTimes(2);
    }
  );

  it('does not report deletion when durable cleanup insertion fails', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('journal unavailable'));
    await expect(f.store.requestDeletion('Uid')).rejects.toThrow(
      'journal unavailable'
    );
  });

  it('does not revive a deleted identity via enable', async () => {
    const f = fixture();
    f.query.mockResolvedValue([
      { ...row, is_active: 0, is_deleted: 1, deleted_at: 100 },
    ]);
    await expect(f.store.setSuspended('Uid', false)).rejects.toThrow();
    expect(f.query).toHaveBeenCalledTimes(1);
  });

  it('reads an unregistered account as an explicit stub without writing', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    expect(await f.store.account('Uid')).toMatchObject({
      identityId: 'Uid',
      status: 'STUB',
      registeredAt: null,
      profile: { name: null },
    });
    expect(f.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function)
    );
    expect(f.query).toHaveBeenCalledTimes(2);
  });
});
