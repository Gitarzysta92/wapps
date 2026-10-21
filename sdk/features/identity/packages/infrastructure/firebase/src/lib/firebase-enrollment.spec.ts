import fetch, { Response } from 'node-fetch';
import {
  CredentialRegistrationRejected,
  IdentityAuthenticationUnavailable,
  PasswordResetRejected,
} from '@sdk/features/identity/libs/authentication';
import { FirebaseRestSessionGateway } from './firebase-rest-session-gateway';
import { FirebasePasswordReset } from './firebase-password-reset';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  Response: jest.requireActual('node-fetch').Response,
}));
const request = fetch as jest.MockedFunction<typeof fetch>;
const session = {
  localId: 'Uid',
  idToken: 'token',
  refreshToken: 'refresh',
  expiresIn: '3600',
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const gateway = new FirebaseRestSessionGateway('key', 'localhost:9099');
const reset = new FirebasePasswordReset('key', 'localhost:9099');

describe('Firebase enrollment and recovery boundaries', () => {
  beforeEach(() => request.mockReset());
  it('creates credentials with bounded requests and validates the returned session', async () => {
    request.mockResolvedValue(response(session));
    expect(
      await gateway.registerOrAuthenticate('alice@example.test', 'password')
    ).toMatchObject({ ok: true, value: { uid: 'Uid' } });
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('accounts:signUp'),
      expect.objectContaining({
        timeout: 10000,
        size: 32768,
        body: JSON.stringify({
          email: 'alice@example.test',
          password: 'password',
          returnSecureToken: true,
        }),
      })
    );
  });
  it('recovers existing credentials only after verifying the supplied password', async () => {
    request
      .mockResolvedValueOnce(
        response({ error: { message: 'EMAIL_EXISTS' } }, 400)
      )
      .mockResolvedValueOnce(response(session));
    expect(
      (await gateway.registerOrAuthenticate('alice@example.test', 'password'))
        .ok
    ).toBe(true);
    expect(request.mock.calls[1][0]).toContain('accounts:signInWithPassword');
    expect(request.mock.calls[1][1]?.body).toBe(
      JSON.stringify({
        email: 'alice@example.test',
        password: 'password',
        returnSecureToken: true,
      })
    );
  });
  it('does not expose a UID or session for an existing account with a wrong password', async () => {
    request
      .mockResolvedValueOnce(
        response({ error: { message: 'EMAIL_EXISTS' } }, 400)
      )
      .mockResolvedValueOnce(
        response({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400)
      );
    expect(
      await gateway.registerOrAuthenticate(
        'alice@example.test',
        'wrong-password'
      )
    ).toMatchObject({
      ok: false,
      error: expect.any(CredentialRegistrationRejected),
    });
  });
  it.each([
    null,
    {},
    { ...session, localId: '' },
    { ...session, expiresIn: '0' },
    { ...session, idToken: 7 },
  ])('rejects malformed successful provider responses', async (body) => {
    request.mockResolvedValue(response(body));
    expect(
      await gateway.registerOrAuthenticate('alice@example.test', 'password')
    ).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
  });
  it.each([429, 500, 503])(
    'does not retry signup or report rejected credentials on HTTP %s',
    async (status) => {
      request.mockResolvedValue(
        response({ error: { message: 'EMAIL_EXISTS' } }, status)
      );
      expect(
        await gateway.registerOrAuthenticate('alice@example.test', 'password')
      ).toMatchObject({
        ok: false,
        error: expect.any(IdentityAuthenticationUnavailable),
      });
      expect(request).toHaveBeenCalledTimes(1);
    }
  );
  it('does not leak provider network diagnostics', async () => {
    request.mockRejectedValue(new Error('https://secret?key=secret'));
    const result = await gateway.signInWithPassword(
      'alice@example.test',
      'password'
    );
    expect(result).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
    if (!result.ok) expect(result.error.message).not.toContain('secret');
  });
  it('validates the refresh response with the same bounds', async () => {
    request.mockResolvedValue(response({ id_token: 'token' }));
    expect(await gateway.refresh('refresh')).toMatchObject({
      ok: false,
      error: expect.any(IdentityAuthenticationUnavailable),
    });
    expect(request.mock.calls[0][1]).toMatchObject({
      timeout: 10000,
      size: 32768,
    });
  });
  it('verifies a reset code without consuming it or disclosing email', async () => {
    request.mockResolvedValue(
      response({ email: 'alice@example.test', requestType: 'PASSWORD_RESET' })
    );
    expect(await reset.verify('code')).toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('accounts:resetPassword'),
      expect.objectContaining({
        body: JSON.stringify({ oobCode: 'code' }),
        timeout: 10000,
        size: 16384,
      })
    );
  });
  it('consumes a reset code with the new password', async () => {
    request.mockImplementation(async () =>
      response({ email: 'alice@example.test', requestType: 'PASSWORD_RESET' })
    );
    await reset.complete('code', 'password');
    expect(request.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ oobCode: 'code', newPassword: 'password' })
    );
  });
  it.each([
    'EXPIRED_OOB_CODE',
    'INVALID_OOB_CODE',
    'USER_DISABLED',
    'WEAK_PASSWORD : policy',
  ])('surfaces %s as a safe action failure', async (code) => {
    request.mockResolvedValue(response({ error: { message: code } }, 400));
    await expect(reset.complete('code', 'password')).rejects.toBeInstanceOf(
      PasswordResetRejected
    );
  });
  it.each(['VERIFY_EMAIL', 'RECOVER_EMAIL', 'VERIFY_AND_CHANGE_EMAIL'])(
    'rejects %s before attempting password mutation',
    async (requestType) => {
      request.mockResolvedValue(
        response({ email: 'alice@example.test', requestType })
      );
      await expect(reset.complete('code', 'password')).rejects.toBeInstanceOf(
        PasswordResetRejected
      );
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0][1]?.body).toBe(
        JSON.stringify({ oobCode: 'code' })
      );
    }
  );
  it('reports ambiguous reset completion as unavailable, never synthetic success', async () => {
    request.mockRejectedValue(new Error('timeout after possible commit'));
    await expect(reset.complete('code', 'password')).rejects.toBeInstanceOf(
      IdentityAuthenticationUnavailable
    );
  });
  it('rejects invalid successful reset responses', async () => {
    request.mockResolvedValue(response({}));
    await expect(reset.verify('code')).rejects.toBeInstanceOf(
      IdentityAuthenticationUnavailable
    );
  });
});
