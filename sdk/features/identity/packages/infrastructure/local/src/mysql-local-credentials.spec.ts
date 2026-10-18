import { scryptSync } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
import {
  MysqlLocalCredentials,
  localPasswordMatches,
} from './mysql-local-credentials';
import {
  localPasswordRecovery,
  localPasswordReset,
  localEmailVerification,
} from './local-credential-actions';

describe('local credential adapter', () => {
  const query = jest.fn();
  const source = { query } as unknown as DataSource;
  const adapter = new MysqlLocalCredentials(source, () => 1000);
  beforeEach(() => jest.resetAllMocks());

  it('verifies salted password hashes without accepting a different password', async () => {
    const salt = 'ab'.repeat(16),
      hash = scryptSync('local-password', salt, 64).toString('hex');
    expect(await localPasswordMatches('local-password', salt, hash)).toBe(true);
    expect(await localPasswordMatches('wrong-password', salt, hash)).toBe(
      false
    );
    await expect(
      localPasswordMatches('local-password', salt, 'corrupt')
    ).rejects.toThrow('Invalid stored credential');
  });
  it.each(['', 'forged', 'x'.repeat(16385), 'a b', 'a'.repeat(42)])(
    'rejects malformed tokens before storage: %s',
    async (token) => {
      const result = await adapter.verifyIdToken(token);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBeInstanceOf(
        CredentialRegistrationRejected
      );
      expect(query).not.toHaveBeenCalled();
    }
  );
  it('distinguishes unknown tokens from unavailable credential storage', async () => {
    query.mockResolvedValueOnce([]);
    const unknown = await adapter.verifyIdToken('a'.repeat(43));
    expect(!unknown.ok && unknown.error).toBeInstanceOf(
      CredentialRegistrationRejected
    );
    query.mockRejectedValueOnce(new Error('private database location'));
    const unavailable = await adapter.verifyIdToken('a'.repeat(43));
    expect(!unavailable.ok && unavailable.error).toBeInstanceOf(
      IdentityAuthenticationUnavailable
    );
    expect(JSON.stringify(unavailable)).not.toContain('private database');
  });
  it.each([{ access_expires_at: 1000 }, { disabled: 1 }, { deleted: 1 }])(
    'rejects unavailable sessions: %j',
    async (patch) => {
      query.mockResolvedValue([
        {
          uid: 'subject',
          email: 'member@example.test',
          auth_time: 500,
          access_expires_at: 2000,
          claims_json: '{}',
          disabled: 0,
          deleted: 0,
          ...patch,
        },
      ]);
      expect((await adapter.verifyIdToken('a'.repeat(43))).ok).toBe(false);
    }
  );
  it('fails closed on corrupted stored authorization claims', async () => {
    query.mockResolvedValue([
      {
        uid: 'subject',
        access_expires_at: 2000,
        claims_json: '{"roles":"admin"}',
      },
    ]);
    expect((await adapter.verifyIdToken('a'.repeat(43))).ok).toBe(false);
  });
  it('exports an allowlisted credential record without secrets or authorization claims', async () => {
    query.mockResolvedValue([
      {
        uid: 'subject',
        email: 'member@example.test',
        created_at: 100,
        last_sign_in_at: null,
        password_salt: 'private salt',
        password_hash: 'private hash',
        claims_json: '{"roles":["staff"]}',
      },
    ]);
    const records = [];
    for await (const record of adapter.capture(
      'subject',
      new AbortController().signal
    ))
      records.push(record);
    expect(records.map((record) => record.type)).toEqual([
      'begin',
      'record',
      'end',
    ]);
    const encoded = JSON.stringify(records);
    expect(encoded).toContain('member@example.test');
    expect(encoded).not.toMatch(/private|password|roles|staff/);
  });
  it('does not certify a missing provider subject as an empty successful export', async () => {
    query.mockResolvedValue([]);
    await expect(
      adapter
        .capture('foreign', new AbortController().signal)
        [Symbol.asyncIterator]()
        .next()
    ).rejects.toThrow('unavailable');
  });
  it('does not pretend to send email or accept verification/recovery codes', async () => {
    await expect(
      localPasswordRecovery.send('member@example.test')
    ).rejects.toThrow('unavailable');
    await expect(
      localPasswordReset.complete('code', 'new-password')
    ).rejects.toThrow('unavailable');
    await expect(
      localEmailVerification(adapter).complete('code')
    ).rejects.toThrow('unavailable');
  });
});
