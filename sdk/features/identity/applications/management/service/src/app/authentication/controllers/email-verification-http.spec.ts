import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CredentialEmailVerificationService,
  EmailVerificationAuthenticationRequired,
  EmailVerificationRejected,
  EmailVerificationThrottled,
} from '@sdk/features/identity/libs/authentication';
import { err, ok } from '@sdk/kernel/standard';
import { EmailVerificationController } from './email-verification.controller';

describe('email verification HTTP boundary', () => {
  const authority = { authorize: jest.fn() };
  const provider = {
    status: jest.fn(),
    request: jest.fn(),
    verify: jest.fn(),
    complete: jest.fn(),
  };
  let app: INestApplication;
  let origin: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [EmailVerificationController],
      providers: [
        {
          provide: CredentialEmailVerificationService,
          useValue: new CredentialEmailVerificationService(authority, provider),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
        validationError: { target: false, value: false },
      })
    );
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.resetAllMocks();
    authority.authorize.mockResolvedValue(ok({ uid: 'current-user' }));
    provider.status.mockResolvedValue({
      email: 'member@example.test',
      verified: false,
    });
    provider.request.mockResolvedValue('requested');
  });
  const request = (path: string, body?: unknown, authorization?: string) =>
    fetch(`${origin}/auth/email-verification/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  it('requires a session for private status and delivery', async () => {
    expect((await request('status')).status).toBe(401);
    expect((await request('request', {})).status).toBe(401);
    expect(provider.status).not.toHaveBeenCalled();
    expect(provider.request).not.toHaveBeenCalled();
  });
  it('uses the authenticated principal, ignores target parameters and prevents caching', async () => {
    const response = await request(
      'status?uid=other&email=other@example.test',
      undefined,
      'Bearer token'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(provider.status).toHaveBeenCalledWith({
      uid: 'current-user',
      token: 'token',
    });
    expect(
      (
        await request(
          'request',
          { uid: 'other', email: 'other@example.test' },
          'Bearer token'
        )
      ).status
    ).toBe(200);
    expect(provider.request).toHaveBeenCalledWith({
      uid: 'current-user',
      token: 'token',
    });
  });
  it('blocks suspended, revoked or otherwise unavailable identities', async () => {
    authority.authorize.mockResolvedValue(
      err(new EmailVerificationAuthenticationRequired('Denied'))
    );
    expect((await request('request', {}, 'Bearer token')).status).toBe(401);
    expect(provider.request).not.toHaveBeenCalled();
  });
  it('inspects and completes bearer action codes without signing in or disclosing email', async () => {
    const verified = await request('verify', { code: 'code' });
    expect(verified.status).toBe(200);
    expect(await verified.json()).toEqual({ valid: true });
    const completed = await request('complete', { code: 'code' });
    expect(await completed.json()).toEqual({ completed: true });
    expect(completed.headers.get('cache-control')).toBe('no-store');
    expect(authority.authorize).not.toHaveBeenCalled();
  });
  it.each([
    { code: '../bad' },
    { code: 42 },
    { code: 'code', email: 'target@example.test' },
    {},
  ])('rejects malformed action bodies: %j', async (body) => {
    expect((await request('complete', body)).status).toBe(400);
    expect(provider.complete).not.toHaveBeenCalled();
  });
  it.each([
    [new EmailVerificationRejected('Expired link'), 400],
    [new EmailVerificationThrottled('Wait'), 429],
    [new Error('Private provider diagnostic'), 503],
  ])(
    'preserves error status without leaking provider diagnostics',
    async (error, status) => {
      provider.complete.mockRejectedValue(error);
      const response = await request('complete', { code: 'code' });
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain(
        'Private provider diagnostic'
      );
    }
  );
});
