import type { Response } from 'express';
import { AuthValidationMiddleware } from './auth-validation.middleware';
import {
  AuthenticatedRequest,
  extractAuthUser,
} from '../decorators/auth-user.decorator';

describe('trusted discussion ingress identity', () => {
  const previous = process.env.INGRESS_AUTH_SECRET;
  const previousExport = process.env.ACCOUNT_EXPORT_SOURCE_SECRET;
  beforeEach(() => {
    process.env.INGRESS_AUTH_SECRET = 'test-secret';
    process.env.ACCOUNT_EXPORT_SOURCE_SECRET = 'e'.repeat(48);
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.INGRESS_AUTH_SECRET;
    else process.env.INGRESS_AUTH_SECRET = previous;
    if (previousExport === undefined)
      delete process.env.ACCOUNT_EXPORT_SOURCE_SECRET;
    else process.env.ACCOUNT_EXPORT_SOURCE_SECRET = previousExport;
  });
  function validate(headers: AuthenticatedRequest['headers']) {
    const request = { headers } as AuthenticatedRequest;
    new AuthValidationMiddleware().use(request, {} as Response, jest.fn());
    return request;
  }
  it('permits public reads but requires a real actor on writes', () => {
    const request = validate({});
    expect(extractAuthUser(request, true).isAnonymous).toBe(true);
    expect(() => extractAuthUser(request)).toThrow('Authentication required');
  });
  it('does not treat a trusted anonymous header as authenticated access', () => {
    const request = validate({
      'x-anonymous': 'true',
      'x-ingress-auth': 'test-secret',
    });
    expect(() => extractAuthUser(request)).toThrow('Authentication required');
  });
  it.each([
    { 'x-user-id': 'victim' },
    { 'x-user-claims': '{"roles":["admin"]}' },
    { 'x-user-id': 'victim', 'x-ingress-auth': 'wrong' },
  ])('rejects identity/role spoofing: %j', (headers) => {
    expect(() => validate(headers)).toThrow('Untrusted');
  });
  it.each(['null', '[]', 'invalid', 'true'])(
    'rejects malformed claims: %s',
    (claims) => {
      expect(() =>
        validate({
          'x-user-id': 'actor',
          'x-ingress-auth': 'test-secret',
          'x-user-claims': claims,
        })
      ).toThrow('Invalid authentication claims');
    }
  );
  it('rejects duplicate identity headers and conflicting anonymous identity', () => {
    expect(() =>
      validate({ 'x-user-id': ['one', 'two'], 'x-ingress-auth': 'test-secret' })
    ).toThrow('Invalid authentication header');
    expect(() =>
      validate({
        'x-user-id': 'actor',
        'x-anonymous': 'true',
        'x-ingress-auth': 'test-secret',
      })
    ).toThrow('Conflicting');
  });
  it('carries verified actor scope to the application boundary', () => {
    const request = validate({
      'x-user-id': 'firebase-uid',
      'x-ingress-auth': 'test-secret',
      'x-user-claims': '{"tenantId":"tenant","roles":["discussion:writer"]}',
    });
    expect(extractAuthUser(request)).toMatchObject({
      userId: 'firebase-uid',
      isAnonymous: false,
      userClaims: { tenantId: 'tenant', roles: ['discussion:writer'] },
    });
  });
  it('binds only the exact service POST route to a fixed profile reader', () => {
    const request = {
      method: 'POST',
      originalUrl: '/api/internal/profile-discussions',
      rawHeaders: ['x-profile-reader', 'test-secret'],
      headers: { 'x-profile-reader': 'test-secret' },
    } as unknown as AuthenticatedRequest;
    const next = jest.fn();
    new AuthValidationMiddleware().use(request, {} as Response, next);
    expect(next).toHaveBeenCalled();
    expect(extractAuthUser(request)).toMatchObject({
      userId: 'wapps-profile-reader',
      isAnonymous: false,
      userClaims: { roles: ['discussion:profile-reader'] },
    });
    for (const changes of [
      { method: 'GET' },
      { originalUrl: '/api/discussions' },
      { originalUrl: '/api/internal/profile-discussions/extra' },
      { headers: {} },
      { headers: { 'x-profile-reader': 'wrong' } },
      {
        headers: { 'x-profile-reader': 'test-secret', 'x-user-id': 'OwnerUid' },
      },
      {
        headers: {
          'x-profile-reader': 'test-secret',
          authorization: 'Bearer session',
        },
      },
      {
        headers: {
          'x-profile-reader': 'test-secret',
          'x-ingress-auth': 'test-secret',
        },
      },
      {
        rawHeaders: [
          'x-profile-reader',
          'test-secret',
          'X-Profile-Reader',
          'test-secret',
        ],
      },
    ]) {
      expect(() =>
        new AuthValidationMiddleware().use(
          { ...request, ...changes } as AuthenticatedRequest,
          {} as Response,
          jest.fn()
        )
      ).toThrow();
    }
  });

  it('requires a separate export credential and assigns only the fixed export actor', () => {
    const request = {
      method: 'POST',
      originalUrl: '/api/internal/account-export',
      headers: { 'x-account-export-reader': 'e'.repeat(48) },
      rawHeaders: [],
    } as unknown as AuthenticatedRequest;
    const next = jest.fn();
    new AuthValidationMiddleware().use(request, {} as Response, next);
    expect(next).toHaveBeenCalled();
    expect(extractAuthUser(request)).toMatchObject({
      userId: 'wapps-account-export-reader',
      userClaims: {
        tenantId: 'account-export',
        roles: ['account-export:reader'],
      },
    });
    for (const changes of [
      { method: 'GET' },
      { originalUrl: '/api/internal/account-export/extra' },
      { originalUrl: '/api/discussions' },
      { headers: {} },
      { headers: { 'x-account-export-reader': 'test-secret' } },
      ...[
        'x-user-id',
        'x-user-claims',
        'x-user-email',
        'x-anonymous',
        'x-auth-time',
        'x-profile-reader',
        'x-ingress-auth',
        'authorization',
        'x-tenant-id',
        'x-roles',
      ].map((name) => ({
        headers: { ...request.headers, [name]: 'injected' },
      })),
      {
        rawHeaders: [
          'x-account-export-reader',
          'e'.repeat(48),
          'X-Account-Export-Reader',
          'e'.repeat(48),
        ],
      },
    ])
      expect(() =>
        new AuthValidationMiddleware().use(
          { ...request, ...changes } as AuthenticatedRequest,
          {} as Response,
          jest.fn()
        )
      ).toThrow();
    for (const secret of [
      undefined,
      'short',
      'x'.repeat(129),
      'has spaces'.repeat(6),
    ]) {
      if (secret === undefined) delete process.env.ACCOUNT_EXPORT_SOURCE_SECRET;
      else process.env.ACCOUNT_EXPORT_SOURCE_SECRET = secret;
      expect(() =>
        new AuthValidationMiddleware().use(request, {} as Response, jest.fn())
      ).toThrow();
    }
    process.env.ACCOUNT_EXPORT_SOURCE_SECRET = 'e'.repeat(48);
    process.env.INGRESS_AUTH_SECRET = 'e'.repeat(48);
    expect(() =>
      new AuthValidationMiddleware().use(request, {} as Response, jest.fn())
    ).toThrow();
  });
});

describe.each([
  'reply-notifications',
  'mention-notifications',
  'favorite-updates',
])('dedicated %s worker authentication', (route) => {
  const previous = { ...process.env };
  const secret = 'qualification-notification-secret-2026-only';
  beforeEach(() => {
    process.env.INGRESS_AUTH_SECRET = 'ingress';
    process.env.ACCOUNT_EXPORT_SOURCE_SECRET = 'export-service-secret'.repeat(
      2
    );
    process.env.ACCOUNT_ERASURE_SECRET = 'erasure-service-secret'.repeat(2);
    process.env.NOTIFICATION_SERVICE_SECRET = secret;
  });
  afterEach(() => {
    for (const key of [
      'INGRESS_AUTH_SECRET',
      'ACCOUNT_EXPORT_SOURCE_SECRET',
      'ACCOUNT_ERASURE_SECRET',
      'NOTIFICATION_SERVICE_SECRET',
    ]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  function run(change: Partial<AuthenticatedRequest> = {}) {
    const request = {
      method: 'POST',
      originalUrl: `/api/internal/${route}`,
      headers: { 'x-notification-worker': secret },
      rawHeaders: ['x-notification-worker', secret],
      ...change,
    } as AuthenticatedRequest;
    new AuthValidationMiddleware().use(request, {} as Response, jest.fn());
    return extractAuthUser(request);
  }
  it('binds the exact internal POST to the service principal', () => {
    expect(run()).toMatchObject({
      userId: 'wapps-notification-worker',
      userClaims: { tenantId: 'notifications', roles: ['notification:worker'] },
    });
  });
  it.each([
    'authorization',
    'x-ingress-auth',
    'x-user-id',
    'x-profile-reader',
    'x-account-export-reader',
    'x-account-erasure-writer',
    'x-tenant-id',
    'x-roles',
  ])('rejects mixed credential or identity header %s', (name) => {
    expect(() =>
      run({ headers: { 'x-notification-worker': secret, [name]: 'injected' } })
    ).toThrow();
  });
  it('rejects missing, duplicated, array and incorrect credentials or routes', () => {
    for (const change of [
      { headers: {} },
      { headers: { 'x-notification-worker': 'wrong' } },
      { headers: { 'x-notification-worker': [secret, secret] } },
      {
        rawHeaders: [
          'x-notification-worker',
          secret,
          'X-Notification-Worker',
          secret,
        ],
      },
      { method: 'GET' },
      { originalUrl: '/api/discussions' },
      { originalUrl: `/api/internal/${route}/extra` },
    ])
      expect(() => run(change)).toThrow();
  });
  it.each([
    'INGRESS_AUTH_SECRET',
    'ACCOUNT_EXPORT_SOURCE_SECRET',
    'ACCOUNT_ERASURE_SECRET',
  ])('rejects reused service secret %s', (key) => {
    process.env[key] = secret;
    expect(() => run()).toThrow();
  });
});
