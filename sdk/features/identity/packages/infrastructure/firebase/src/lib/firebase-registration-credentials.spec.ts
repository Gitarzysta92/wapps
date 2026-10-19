import * as admin from 'firebase-admin';
import type { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import { err, ok } from '@sdk/kernel/standard';
import { IdentityAuthenticationUnavailable } from '@sdk/features/identity/libs/authentication';
import { FirebaseRegistrationCredentials } from './firebase-registration-credentials';
import { FirebaseRestSessionGateway } from './firebase-rest-session-gateway';

jest.mock('firebase-admin', () => ({ auth: jest.fn() }));

function fixture() {
  let receipt:
    | { subject: Buffer; request_hash: Buffer; created: number }
    | undefined;
  const query = jest.fn(async (sql: string, args: unknown[]) => {
    if (sql.startsWith('INSERT'))
      receipt ??= {
        subject: Buffer.from(String(args[3])),
        request_hash: args[2] as Buffer,
        created: 0,
      };
    if (sql.startsWith('SELECT')) return receipt ? [{ ...receipt }] : [];
    if (sql.startsWith('UPDATE') && receipt) receipt.created = 1;
    if (sql.startsWith('DELETE')) receipt = undefined;
    return { affectedRows: 1 };
  });
  const providerUsers = new Map<string, { uid: string; password: string }>();
  const createUser = jest.fn(
    async (input: { uid: string; email: string; password: string }) => {
      if (providerUsers.has(input.email))
        throw { code: 'auth/email-already-exists' };
      providerUsers.set(input.email, input);
      return input;
    }
  );
  (admin.auth as unknown as jest.Mock).mockReturnValue({ createUser });
  const signInWithPassword = jest.fn(
    async (email: string, password: string) => {
      const user = providerUsers.get(email);
      return user?.password === password
        ? ok({
            uid: user.uid,
            token: 'token',
            refreshToken: 'refresh',
            expiresIn: '3600',
          })
        : err(new Error('Rejected'));
    }
  );
  const source = {
    query,
    createQueryRunner: () => ({
      query,
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    }),
  } as unknown as DataSource;
  const sessions = {
    signInWithPassword,
    refresh: jest.fn(),
  } as unknown as FirebaseRestSessionGateway;
  return {
    adapter: new FirebaseRegistrationCredentials(
      source,
      sessions,
      'firebase-project'
    ),
    restart: () =>
      new FirebaseRegistrationCredentials(source, sessions, 'firebase-project'),
    query,
    createUser,
    signInWithPassword,
    providerUsers,
    receipt: () => receipt,
  };
}

describe('Firebase enrollment receipts', () => {
  it('permits corrected registration after a definitive provider input rejection', async () => {
    const f = fixture();
    f.createUser.mockRejectedValueOnce({ code: 'auth/invalid-password' });
    expect(
      (await f.adapter.registerOrAuthenticate('a@example.test', 'bad', 'key'))
        .ok
    ).toBe(false);
    expect(f.receipt()).toBeUndefined();
    expect(
      await f.adapter.registerOrAuthenticate(
        'a@example.test',
        'password',
        'corrected-key'
      )
    ).toMatchObject({ ok: true, value: { enrollmentEligible: true } });
  });
  it('reserves a subject, verifies the credential and survives adapter restart', async () => {
    const f = fixture();
    const first = await f.adapter.registerOrAuthenticate(
      'a@example.test',
      'password',
      'key'
    );
    expect(first).toMatchObject({
      ok: true,
      value: { enrollmentEligible: true },
    });
    expect(
      await f
        .restart()
        .registerOrAuthenticate('a@example.test', 'password', 'key')
    ).toEqual(first);
    expect(f.createUser).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls[0][1]).toEqual([
      'firebase-project',
      createHash('sha256').update('a@example.test').digest(),
      createHash('sha256').update('key').digest(),
      expect.any(String),
    ]);
    expect(JSON.stringify(f.query.mock.calls)).not.toContain('password');
  });

  it('recovers the same subject after an ambiguous provider creation', async () => {
    const f = fixture();
    const create = f.createUser.getMockImplementation();
    f.createUser.mockImplementationOnce(async (input) => {
      await create?.(input);
      throw new Error('lost response');
    });
    expect(
      await f.adapter.registerOrAuthenticate(
        'a@example.test',
        'password',
        'key'
      )
    ).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
    expect(
      await f
        .restart()
        .registerOrAuthenticate('a@example.test', 'password', 'key')
    ).toMatchObject({ ok: true, value: { enrollmentEligible: true } });
    expect(f.providerUsers.size).toBe(1);
  });

  it('recovers when marking the receipt fails after provider creation', async () => {
    const f = fixture();
    const query = f.query.getMockImplementation();
    let failed = false;
    f.query.mockImplementation(async (sql, args) => {
      if (sql.startsWith('UPDATE') && !failed) {
        failed = true;
        throw new Error('connection lost');
      }
      if (!query) throw new Error('Missing fixture query');
      return query(sql, args);
    });
    expect(
      (
        await f.adapter.registerOrAuthenticate(
          'a@example.test',
          'password',
          'key'
        )
      ).ok
    ).toBe(false);
    expect(
      await f
        .restart()
        .registerOrAuthenticate('a@example.test', 'password', 'key')
    ).toMatchObject({ ok: true, value: { enrollmentEligible: true } });
  });

  it('does not adopt credentials that predate the receipt', async () => {
    const f = fixture();
    f.providerUsers.set('a@example.test', {
      uid: 'existing',
      password: 'password',
    });
    expect(
      await f.adapter.registerOrAuthenticate(
        'a@example.test',
        'password',
        'key'
      )
    ).toMatchObject({
      ok: true,
      value: { uid: 'existing', enrollmentEligible: false },
    });
    expect(f.receipt()?.created).toBe(0);
  });

  it('does not grant enrollment to a different retry key or wrong password', async () => {
    const f = fixture();
    await f.adapter.registerOrAuthenticate('a@example.test', 'password', 'key');
    expect(
      await f.adapter.registerOrAuthenticate(
        'a@example.test',
        'password',
        'other-key'
      )
    ).toMatchObject({ ok: true, value: { enrollmentEligible: false } });
    expect(
      (await f.adapter.registerOrAuthenticate('a@example.test', 'wrong', 'key'))
        .ok
    ).toBe(false);
  });

  it('does not recreate a previously completed and deleted credential', async () => {
    const f = fixture();
    await f.adapter.registerOrAuthenticate('a@example.test', 'password', 'key');
    f.providerUsers.clear();
    expect(
      (
        await f.adapter.registerOrAuthenticate(
          'a@example.test',
          'password',
          'key'
        )
      ).ok
    ).toBe(false);
    expect(f.createUser).toHaveBeenCalledTimes(1);
  });

  it('does not contact the provider when the receipt cannot be persisted', async () => {
    const f = fixture();
    f.query.mockRejectedValueOnce(new Error('SQL unavailable'));
    expect(
      (
        await f.adapter.registerOrAuthenticate(
          'a@example.test',
          'password',
          'key'
        )
      ).ok
    ).toBe(false);
    expect(f.createUser).not.toHaveBeenCalled();
    expect(f.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'bad key'])(
    'rejects an invalid enrollment key %j',
    async (key) => {
      const f = fixture();
      expect(
        (
          await f.adapter.registerOrAuthenticate(
            'a@example.test',
            'password',
            key
          )
        ).ok
      ).toBe(false);
      expect(f.query).not.toHaveBeenCalled();
    }
  );
});
