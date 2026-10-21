import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WA_WINDOW } from '@ng-web-apis/common';
import { firstValueFrom } from 'rxjs';
import { IdentityRegistrationApiService } from './identity-registration-api.service';
import { PasswordResetRequestApiService } from './password-reset-request-api.service';
import { PasswordResetApiService } from './password-reset-api.service';
import { IdentityApiService } from './identity-api.service';
import { IDENTITY_CONNECTION, IdentityConnection } from './identity-connection';
import { BffAuthenticationService } from './bff/bff-authentication.service';
import { AUTH_BFF_URL } from './bff/auth-bff-url.token';
import { AUTHENTICATION_SESSION } from '../application/authentication-session.port';

describe('real identity HTTP adapters', () => {
  let http: HttpTestingController;
  const connection: IdentityConnection = {
    mode: 'api',
    authBaseUrl: 'https://auth.example.test',
    accountBaseUrl: 'https://account.example.test',
  };
  const input = {
    email: 'alice@example.test',
    nickname: 'Alice',
    password: 'password',
    passwordConfirmation: 'password',
  };
  const session = {
    uid: 'Uid',
    token: 'token',
    refreshToken: 'refresh',
    expiresIn: '3600',
  };
  const browserStorage = {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  };
  const tokens = {
    getToken: jest.fn(),
    setToken: jest.fn(),
    setRefreshToken: jest.fn(),
    getRefreshToken: jest.fn(),
    clear: jest.fn(),
    clearRefreshToken: jest.fn(),
  };
  let key = 0;
  beforeEach(() => {
    jest.resetAllMocks();
    key = 0;
    connection.mode = 'api';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        IdentityRegistrationApiService,
        PasswordResetRequestApiService,
        PasswordResetApiService,
        IdentityApiService,
        BffAuthenticationService,
        { provide: IDENTITY_CONNECTION, useValue: connection },
        { provide: AUTH_BFF_URL, useValue: connection.authBaseUrl },
        { provide: AUTHENTICATION_SESSION, useValue: tokens },
        {
          provide: WA_WINDOW,
          useValue: {
            crypto: { randomUUID: () => `command-${++key}` },
            localStorage: browserStorage,
            location: { origin: 'https://portal.example.test' },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it.each([200, 401])(
    'does not replace or clear refresh credentials after the account changes: %s',
    async (status) => {
      tokens.getToken.mockReturnValue('alice-access');
      tokens.getRefreshToken.mockReturnValue('alice-refresh');
      const result = firstValueFrom(
        TestBed.inject(BffAuthenticationService).refreshToken()
      );
      const request = http.expectOne(`${connection.authBaseUrl}/auth/refresh`);
      tokens.getToken.mockReturnValue('bob-access');
      tokens.getRefreshToken.mockReturnValue('bob-refresh');
      request.flush(status === 200 ? session : {}, {
        status,
        statusText: status === 200 ? 'OK' : 'Unauthorized',
      });
      expect((await result).ok).toBe(false);
      expect(tokens.setRefreshToken).not.toHaveBeenCalled();
      expect(tokens.clearRefreshToken).not.toHaveBeenCalled();
    }
  );
  it('retains its registration key for retry without writing credentials to browser storage', async () => {
    const api = TestBed.inject(IdentityRegistrationApiService);
    const first = firstValueFrom(api.register(input));
    const a = http.expectOne(`${connection.authBaseUrl}/auth/register`);
    expect(a.request.body).toEqual(input);
    expect(a.request.headers.get('Idempotency-Key')).toBe('command-1');
    a.flush({}, { status: 503, statusText: 'Unavailable' });
    expect((await first).ok).toBe(false);
    const retry = firstValueFrom(api.register(input));
    const b = http.expectOne(`${connection.authBaseUrl}/auth/register`);
    expect(b.request.headers.get('Idempotency-Key')).toBe('command-1');
    b.flush(session);
    expect(await retry).toEqual({ ok: true, value: true });
    expect(browserStorage.setItem).not.toHaveBeenCalled();
    const changed = firstValueFrom(
      api.register({ ...input, nickname: 'Another name' })
    );
    const c = http.expectOne(`${connection.authBaseUrl}/auth/register`);
    expect(c.request.headers.get('Idempotency-Key')).toBe('command-2');
    c.flush(session);
    await changed;
  });
  it('rejects a malformed session instead of announcing a registered account', async () => {
    const result = firstValueFrom(
      TestBed.inject(IdentityRegistrationApiService).register(input)
    );
    http.expectOne(`${connection.authBaseUrl}/auth/register`).flush({});
    expect((await result).ok).toBe(false);
  });
  it('requests actual provider delivery through the account API contract', async () => {
    const result = firstValueFrom(
      TestBed.inject(PasswordResetRequestApiService).requestPasswordReset({
        login: input.email,
      })
    );
    const request = http.expectOne(
      `${connection.accountBaseUrl}/api/password-recovery`
    );
    expect(request.request.body).toEqual({ email: input.email });
    request.flush({ accepted: true }, { status: 202, statusText: 'Accepted' });
    expect(await result).toEqual({ ok: true, value: undefined });
  });
  it('returns a delivery error on rate limits and backend outages', async () => {
    for (const status of [429, 503]) {
      const result = firstValueFrom(
        TestBed.inject(PasswordResetRequestApiService).requestPasswordReset({
          login: input.email,
        })
      );
      http
        .expectOne(`${connection.accountBaseUrl}/api/password-recovery`)
        .flush({}, { status, statusText: 'Failed' });
      expect((await result).ok).toBe(false);
    }
  });
  it('posts reset codes and new passwords in bodies, never URLs', async () => {
    const api = TestBed.inject(PasswordResetApiService);
    const verify = firstValueFrom(api.verifyCode('one-time-code'));
    const a = http.expectOne(
      `${connection.authBaseUrl}/auth/password-reset/verify`
    );
    expect(a.request.body).toEqual({ code: 'one-time-code' });
    a.flush({ valid: true });
    expect((await verify).ok).toBe(true);
    const body = {
      code: 'one-time-code',
      password: 'new-password',
      passwordConfirmation: 'new-password',
    };
    const result = firstValueFrom(api.resetPassword(body));
    const b = http.expectOne(
      `${connection.authBaseUrl}/auth/password-reset/complete`
    );
    expect(b.request.body).toEqual(body);
    b.flush({ completed: true });
    expect((await result).ok).toBe(true);
  });
  it('loads the canonical identity rather than a fixed demo user', async () => {
    const result = firstValueFrom(
      TestBed.inject(IdentityApiService).getIdentity()
    );
    http.expectOne(`${connection.accountBaseUrl}/api/me`).flush({
      identityId: 'Uid',
      account: { status: 'ACTIVE' },
      profile: { name: 'Alice' },
    });
    expect(await result).toEqual({
      ok: true,
      value: { id: 'Uid', name: 'Alice' },
    });
  });
  it('does not fabricate an identity after lookup failure', async () => {
    const result = firstValueFrom(
      TestBed.inject(IdentityApiService).getIdentity()
    );
    http
      .expectOne(`${connection.accountBaseUrl}/api/me`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect((await result).ok).toBe(false);
  });
  it('does not advertise an invented sign-in method during an outage', async () => {
    const result = firstValueFrom(
      TestBed.inject(BffAuthenticationService).getAvailableMethods()
    );
    const rejection = expect(result).rejects.toMatchObject({ status: 503 });
    http
      .expectOne(`${connection.authBaseUrl}/auth/methods`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await rejection;
  });
  it('stores real refresh credentials through the session port', async () => {
    const result = firstValueFrom(
      TestBed.inject(BffAuthenticationService).authenticate({
        login: input.email,
        password: input.password,
      })
    );
    http.expectOne(`${connection.authBaseUrl}/auth/signin`).flush(session);
    expect(await result).toEqual({ ok: true, value: 'token' });
    expect(tokens.setRefreshToken).toHaveBeenCalledWith('refresh');
  });
  it('reports unavailable local persistence instead of confirming sign-in', async () => {
    tokens.setRefreshToken.mockImplementation(() => {
      throw new Error('Browser storage unavailable');
    });
    const result = firstValueFrom(
      TestBed.inject(BffAuthenticationService).authenticate({
        login: input.email,
        password: input.password,
      })
    );
    http.expectOne(`${connection.authBaseUrl}/auth/signin`).flush(session);
    expect((await result).ok).toBe(false);
  });
  it('distinguishes local logout from failed server revocation', async () => {
    const result = firstValueFrom(
      TestBed.inject(BffAuthenticationService).signOut()
    );
    http
      .expectOne(`${connection.authBaseUrl}/auth/signout`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect((await result).ok).toBe(false);
    expect(tokens.clear).toHaveBeenCalled();
  });
  it('does not clear another account after delayed sign-out completion', async () => {
    tokens.getToken.mockReturnValue('alice-access');
    const result = firstValueFrom(
      TestBed.inject(BffAuthenticationService).signOut()
    );
    const request = http.expectOne(`${connection.authBaseUrl}/auth/signout`);
    tokens.getToken.mockReturnValue('bob-access');
    request.flush({});
    expect((await result).ok).toBe(true);
    expect(tokens.clear).not.toHaveBeenCalled();
  });
  it('never simulates credential operations in explicit demo mode', async () => {
    connection.mode = 'demo';
    expect(
      (
        await firstValueFrom(
          TestBed.inject(IdentityRegistrationApiService).register(input)
        )
      ).ok
    ).toBe(false);
    expect(
      (
        await firstValueFrom(
          TestBed.inject(PasswordResetRequestApiService).requestPasswordReset({
            login: input.email,
          })
        )
      ).ok
    ).toBe(false);
    http.expectNone(() => true);
  });
  it('binds OAuth completion to a recent local context and stores the validated session', async () => {
    const context = {
      provider: 'google',
      redirectUri: 'https://portal.example.test/auth/callback',
      returnTo: '/me/profile',
      createdAt: Date.now(),
      codeVerifier: 'v'.repeat(43),
    };
    browserStorage.getItem.mockReturnValue(JSON.stringify(context));
    const result = firstValueFrom(
      TestBed.inject(BffAuthenticationService).completeCallback({
        state: 's'.repeat(32),
        code: 'code',
        error: null,
      })
    );
    const request = http.expectOne(
      `${connection.authBaseUrl}/auth/signin/oauth`
    );
    expect(request.request.body).toMatchObject({
      codeVerifier: context.codeVerifier,
      provider: 'google',
      code: 'code',
    });
    request.flush(session);
    expect(await result).toEqual({ ok: true, value: '/me/profile' });
    expect(tokens.setToken).toHaveBeenCalledWith('token');
    expect(browserStorage.removeItem).toHaveBeenCalledWith(
      `oauth_ctx_${'s'.repeat(32)}`
    );
  });
  it.each([
    { returnTo: '//attacker.test/' },
    { returnTo: '/\\attacker.test/' },
    { createdAt: 1 },
    { redirectUri: 'https://attacker.test/auth/callback' },
    { codeVerifier: null },
    { provider: 'unknown' },
  ])('rejects invalid OAuth context before exchange: %j', async (patch) => {
    browserStorage.getItem.mockReturnValue(
      JSON.stringify({
        provider: 'google',
        redirectUri: 'https://portal.example.test/auth/callback',
        returnTo: '/home',
        createdAt: Date.now(),
        codeVerifier: 'v'.repeat(43),
        ...patch,
      })
    );
    expect(
      (
        await firstValueFrom(
          TestBed.inject(BffAuthenticationService).completeCallback({
            state: 's'.repeat(32),
            code: 'code',
            error: null,
          })
        )
      ).ok
    ).toBe(false);
    http.expectNone(() => true);
    expect(tokens.setToken).not.toHaveBeenCalled();
  });
  it('rejects unsolicited OAuth callbacks without a local state record', async () => {
    browserStorage.getItem.mockReturnValue(null);
    expect(
      (
        await firstValueFrom(
          TestBed.inject(BffAuthenticationService).completeCallback({
            state: 's'.repeat(32),
            code: 'code',
            error: null,
          })
        )
      ).ok
    ).toBe(false);
    http.expectNone(() => true);
  });
});
