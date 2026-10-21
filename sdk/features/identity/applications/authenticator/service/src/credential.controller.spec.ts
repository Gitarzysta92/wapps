import { ConfigService } from '@nestjs/config';
import { CredentialController } from './credential.controller';
import type { CredentialAdapters } from './credential-providers';
import { ok } from '@sdk/kernel/standard';
import type { Request } from 'express';

describe('credential-only service boundary', () => {
  const secret = 'qualification-secret-'.repeat(3),
    issuer = 'issuer-A';
  function fixture() {
    const session = {
      uid: 'external-subject',
      token: 'access',
      refreshToken: 'refresh',
      expiresIn: '3600',
    };
    const adapters = {
      sessions: {
        signInWithPassword: jest.fn().mockResolvedValue(ok(session)),
        registerOrAuthenticate: jest
          .fn()
          .mockResolvedValue(ok({ ...session, enrollmentEligible: true })),
      },
      verifier: {
        verifyIdToken: jest.fn().mockResolvedValue(ok({ uid: session.uid })),
      },
      admin: {
        revokeRefreshTokens: jest.fn().mockResolvedValue(ok(true)),
        deleteUser: jest.fn().mockResolvedValue(ok(true)),
      },
      email: {
        status: jest.fn().mockResolvedValue({ email: null, verified: false }),
      },
    };
    const controller = new CredentialController(
      adapters as unknown as CredentialAdapters,
      new ConfigService({ AUTH_SERVICE_SECRET: secret, AUTH_ISSUER: issuer })
    );
    const request = {
      headers: { 'x-credential-service': secret },
      rawHeaders: ['x-credential-service', secret],
      query: {},
    } as unknown as Request;
    return { controller, adapters, request };
  }
  it('returns only an issuer-qualified credential session', async () => {
    const f = fixture();
    expect(
      await f.controller.execute(
        'password-session',
        { email: 'a@example.test', password: 'password' },
        f.request
      )
    ).toEqual({
      issuer,
      value: {
        subject: 'external-subject',
        token: 'access',
        refreshToken: 'refresh',
        expiresIn: '3600',
      },
    });
  });
  it('preserves the verified new-registration receipt without enrolling a profile', async () => {
    const f = fixture();
    expect(
      await f.controller.execute(
        'registration',
        { email: 'a@example.test', password: 'password', key: 'retry-key' },
        f.request
      )
    ).toMatchObject({ issuer, value: { enrollmentEligible: true } });
    expect(f.adapters.sessions.registerOrAuthenticate).toHaveBeenCalledWith(
      'a@example.test',
      'password',
      'retry-key'
    );
  });
  it.each(['authorization', 'x-user-id', 'x-user-claims', 'x-ingress-auth'])(
    'rejects mixed browser/identity credential header %s',
    async (header) => {
      const f = fixture();
      f.request.headers[header] = 'forged';
      await expect(
        f.controller.execute(
          'delete',
          { subject: 'external-subject' },
          f.request
        )
      ).rejects.toMatchObject({ status: 401 });
      expect(f.adapters.admin.deleteUser).not.toHaveBeenCalled();
    }
  );
  it('rejects missing, wrong and duplicate service credentials', async () => {
    const f = fixture();
    f.request.headers['x-credential-service'] = 'wrong';
    await expect(
      f.controller.execute('revoke', { subject: 'external-subject' }, f.request)
    ).rejects.toMatchObject({ status: 401 });
    f.request.headers['x-credential-service'] = secret;
    f.request.rawHeaders.push('X-Credential-Service', secret);
    await expect(
      f.controller.execute('revoke', { subject: 'external-subject' }, f.request)
    ).rejects.toMatchObject({ status: 401 });
  });
  it.each([
    { uid: 'wapps-id' },
    { subject: 'external-subject', identityId: 'wapps-id' },
    { subject: 'external-subject', roles: ['admin'] },
  ])('rejects application identity fields %j', async (body) => {
    const f = fixture();
    await expect(
      f.controller.execute('delete', body, f.request)
    ).rejects.toMatchObject({ status: 400 });
    expect(f.adapters.admin.deleteUser).not.toHaveBeenCalled();
  });
  it('rejects conflicting token and subject for credential email actions', async () => {
    const f = fixture();
    await expect(
      f.controller.execute(
        'email-status',
        { subject: 'another', token: 'access' },
        f.request
      )
    ).rejects.toMatchObject({ status: 401 });
    expect(f.adapters.email.status).not.toHaveBeenCalled();
  });
  it('never fabricates a successful revocation receipt', async () => {
    const f = fixture();
    f.adapters.admin.revokeRefreshTokens.mockResolvedValue(ok(false));
    await expect(
      f.controller.execute('revoke', { subject: 'external-subject' }, f.request)
    ).rejects.toMatchObject({ status: 503 });
  });
});
