import { RemoteCredentials } from './remote-credentials';
import { CredentialUnavailable } from '@sdk/features/identity/libs/management';
import { IdentityAuthenticationUnavailable } from '@sdk/features/identity/libs/authentication';

describe('independent authentication service client', () => {
  const issuer = 'Auth-A',
    secret = 'qualification-secret-'.repeat(3);
  const session = {
    subject: 'external-subject',
    token: 'opaque-access',
    refreshToken: 'opaque-refresh',
    expiresIn: '3600',
  };
  function fixture() {
    const bindings = {
      findCredential: jest.fn(),
      enrollCredential: jest.fn(),
      credentialSubjects: jest
        .fn()
        .mockResolvedValue([{ issuer, subject: 'external-subject' }]),
    };
    const send = jest.fn();
    const client = new RemoteCredentials(
      'http://authentication.test',
      issuer,
      secret,
      bindings,
      send
    );
    const reply = (value: unknown, responseIssuer = issuer) =>
      send.mockImplementation(
        (_url, init) =>
          new Response(
            JSON.stringify({
              issuer: responseIssuer,
              subject: JSON.parse(init.body).subject,
              value,
            }),
            { headers: { 'content-type': 'application/json' } }
          )
      );
    return { client, bindings, send, reply };
  }
  it('uses the bounded credential API without application identity headers or database access', async () => {
    const f = fixture();
    f.reply(session);
    expect(
      await f.client.signInWithPassword('a@example.test', 'password')
    ).toEqual({
      ok: true,
      value: {
        uid: session.subject,
        token: session.token,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
    });
    const [url, options] = f.send.mock.calls[0];
    expect(url.toString()).toBe(
      'http://authentication.test/credentials/password-session'
    );
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'x-credential-service': secret },
    });
    expect(JSON.parse(options.body)).toEqual({
      email: 'a@example.test',
      password: 'password',
    });
    expect(f.bindings.credentialSubjects).not.toHaveBeenCalled();
  });
  it('preserves registration eligibility for durable retry and does not invent it', async () => {
    const f = fixture();
    f.reply({ ...session, enrollmentEligible: true });
    expect(
      await f.client.registerOrAuthenticate(
        'a@example.test',
        'password',
        'request-1'
      )
    ).toMatchObject({ ok: true, value: { enrollmentEligible: true } });
    f.reply(session);
    expect(
      await f.client.registerOrAuthenticate(
        'a@example.test',
        'password',
        'request-1'
      )
    ).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
  });
  it.each(['auth-a', 'Auth-A ', 'Auth-B'])(
    'refuses exact-issuer mismatch %j',
    async (wrong) => {
      const f = fixture();
      f.reply(session, wrong);
      expect(
        (await f.client.signInWithPassword('a@example.test', 'password')).ok
      ).toBe(false);
    }
  );
  it('maps a Wapps identity to its credential subject for staff revocation', async () => {
    const f = fixture();
    f.reply({ confirmed: true });
    expect(await f.client.revokeRefreshTokens('stable-wapps-id')).toEqual({
      ok: true,
      value: true,
    });
    expect(f.bindings.credentialSubjects).toHaveBeenCalledWith(
      'stable-wapps-id'
    );
    expect(JSON.parse(f.send.mock.calls[0][1].body)).toEqual({
      subject: 'external-subject',
    });
  });
  it('rejects a completion receipt for another credential subject', async () => {
    const f = fixture();
    f.send.mockResolvedValue(new Response(JSON.stringify({ issuer, subject: 'another-subject', value: { confirmed: true } }), { headers: { 'content-type': 'application/json' } }));
    expect((await f.client.revokeRefreshTokens('stable-wapps-id')).ok).toBe(false);
  });
  it('reports rejected service authentication as an outage, not a bad member password', async () => {
    const f = fixture();
    f.send.mockResolvedValue(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }));
    expect(await f.client.signInWithPassword('a@example.test', 'password')).toMatchObject({ ok: false, error: expect.any(IdentityAuthenticationUnavailable) });
  });
  it.each([
    { bindings: [] },
    { bindings: [{ issuer: 'unconfigured', subject: 'same-subject' }] },
  ])(
    'fails closed before administration when binding is missing or issuer unconfigured',
    async ({ bindings }) => {
      const f = fixture();
      f.bindings.credentialSubjects.mockResolvedValue(bindings);
      expect(await f.client.deleteUser('stable-wapps-id')).toMatchObject({
        ok: false,
        error: expect.any(CredentialUnavailable),
      });
      expect(f.send).not.toHaveBeenCalled();
    }
  );
  it('requires every bound subject to confirm deletion', async () => {
    const f = fixture();
    f.bindings.credentialSubjects.mockResolvedValue([
      { issuer, subject: 'one' },
      { issuer, subject: 'two' },
    ]);
    f.send
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            issuer,
            subject: 'one',
            value: { confirmed: true },
          }),
          { headers: { 'content-type': 'application/json' } }
        )
      )
      .mockRejectedValueOnce(new Error('offline'));
    expect((await f.client.deleteUser('stable-wapps-id')).ok).toBe(false);
    expect(f.send).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { confirmed: false }, { confirmed: true, extra: 'unexpected' }])(
    'rejects unconfirmed credential administration %j',
    async (value) => {
      const f = fixture();
      f.reply(value);
      expect((await f.client.revokeRefreshTokens('stable-wapps-id')).ok).toBe(
        false
      );
    }
  );
  it.each([201, 204, 302, 404, 500])(
    'does not retry or accept unexpected HTTP %s',
    async (status) => {
      const f = fixture();
      f.send.mockResolvedValue(new Response(null, { status }));
      expect((await f.client.revokeRefreshTokens('stable-wapps-id')).ok).toBe(
        false
      );
      expect(f.send).toHaveBeenCalledTimes(1);
    }
  );
  it('rejects oversized responses and internal provider fields', async () => {
    const f = fixture();
    f.reply({ ...session, privateField: 'secret' });
    expect(
      (await f.client.signInWithPassword('a@example.test', 'password')).ok
    ).toBe(false);
    f.reply({ ...session, token: 'a'.repeat(300000) });
    expect(
      (await f.client.signInWithPassword('a@example.test', 'password')).ok
    ).toBe(false);
  });
  it('requires the complete credential export receipt before yielding its records', async () => {
    const f = fixture();
    f.reply({
      entries: [
        { type: 'begin', source: 'credentials', at: 100 },
        {
          type: 'record',
          source: 'credentials',
          collection: 'credential-user',
          data: { uid: 'external-subject' },
        },
      ],
    });
    const entries: unknown[] = [];
    await expect(
      (async () => {
        for await (const entry of f.client.capture(
          'stable-wapps-id',
          new AbortController().signal
        ))
          entries.push(entry);
      })()
    ).rejects.toThrow();
    expect(entries).toHaveLength(1);
  });
});
