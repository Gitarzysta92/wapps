import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { CanonicalIdentityStore } from '@sdk/features/identity/core';
import type { AuthenticatedRequest } from '../decorators/auth-user.decorator';
import { AuthValidationMiddleware } from './auth-validation.middleware';

describe('mention resolver service authentication', () => {
  const secret = 'qualification-notification-secret-2026-only';
  const previous = process.env['NOTIFICATION_SERVICE_SECRET'];
  beforeEach(() => {
    process.env['NOTIFICATION_SERVICE_SECRET'] = secret;
  });
  afterAll(() => {
    if (previous === undefined)
      delete process.env['NOTIFICATION_SERVICE_SECRET'];
    else process.env['NOTIFICATION_SERVICE_SECRET'] = previous;
  });
  function fixture(
    headers: Record<string, string> = {},
    path = '/api/internal/mention-recipients',
    method = 'POST'
  ) {
    const find = jest.fn();
    const request = {
      method,
      originalUrl: path,
      headers: { 'x-notification-worker': secret, ...headers },
      rawHeaders: [],
    } as unknown as AuthenticatedRequest;
    const next = jest.fn();
    const middleware = new AuthValidationMiddleware({
      find,
    } as unknown as CanonicalIdentityStore);
    return {
      request,
      find,
      next,
      run: () => middleware.use(request, {} as Response, next),
    };
  }
  it('supplies the exact service principal without impersonating a user', async () => {
    const f = fixture();
    await f.run();
    expect(f.request.authUser).toEqual({
      userId: 'wapps-notification-worker',
      userClaims: { tenantId: 'notifications', roles: ['notification:worker'] },
      isAnonymous: false,
    });
    expect(f.next).toHaveBeenCalledTimes(1);
    expect(f.find).not.toHaveBeenCalled();
  });
  it.each([
    'authorization',
    'x-ingress-auth',
    'x-user-id',
    'x-user-claims',
    'x-user-email',
    'x-auth-time',
    'x-anonymous',
  ])('rejects mixed service and %s credentials', async (name) => {
    const f = fixture({ [name]: 'conflicting' });
    await expect(f.run()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.request.authUser).toBeUndefined();
  });
  it.each(['', 'wrong', 'x'.repeat(128)])(
    'rejects invalid service secret %s',
    async (value) => {
      await expect(
        fixture({ 'x-notification-worker': value }).run()
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  );
  it('rejects duplicate credentials', async () => {
    const f = fixture();
    f.request.rawHeaders = [
      'X-Notification-Worker',
      secret,
      'x-notification-worker',
      secret,
    ];
    await expect(f.run()).rejects.toBeInstanceOf(BadRequestException);
  });
  it('limits the credential to the exact POST endpoint', async () => {
    for (const [path, method] of [
      ['/api/me', 'GET'],
      ['/api/internal/mention-recipients', 'GET'],
      ['/api/internal/mention-recipients/extra', 'POST'],
    ])
      await expect(fixture({}, path, method).run()).rejects.toBeInstanceOf(
        UnauthorizedException
      );
  });
  it('fails closed with missing configuration', async () => {
    delete process.env['NOTIFICATION_SERVICE_SECRET'];
    await expect(fixture().run()).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('account optional profile authentication', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const before = process.env['INGRESS_AUTH_SECRET'];
  beforeEach(() => {
    process.env['INGRESS_AUTH_SECRET'] = 'trusted';
  });
  afterAll(() => {
    if (before === undefined) delete process.env['INGRESS_AUTH_SECRET'];
    else process.env['INGRESS_AUTH_SECRET'] = before;
  });
  function fixture(
    path: string,
    headers: Record<string, string> = {},
    method = 'GET'
  ) {
    const find = jest.fn().mockResolvedValue({
      identityId: 'Uid',
      isActive: true,
      isSuspended: false,
      isDeleted: false,
    });
    const identities = { find } as unknown as CanonicalIdentityStore;
    const request = {
      method,
      originalUrl: path,
      headers: {
        'x-ingress-auth': 'trusted',
        'x-anonymous': 'true',
        ...headers,
      },
      rawHeaders: [],
    } as unknown as AuthenticatedRequest;
    const next = jest.fn();
    const middleware = new AuthValidationMiddleware(identities);
    return {
      request,
      find,
      next,
      run: () => middleware.use(request, {} as Response, next),
    };
  }
  it.each([
    '/api/profiles',
    `/api/profiles/${id}`,
    `/api/profiles/${id}/avatar/${id}`,
    `/api/profiles/${id}/favorites?after=applications%3A${id}`,
    `/api/profiles/${id}/suites?after=${id}`,
    `/api/profiles/${id}/articles?after=${id}`,
  ])('accepts explicit trusted anonymous GET %s', async (path) => {
    const f = fixture(path);
    await f.run();
    expect(f.next).toHaveBeenCalledTimes(1);
    expect(f.find).not.toHaveBeenCalled();
    expect(f.request.authUser).toBeUndefined();
  });
  it.each([
    '/api/me/profile',
    '/api/me/profile-follows',
    '/api/profiles-other',
    `/api/profiles/${id}/private`,
    `/api/profiles/${id}/favorites/private`,
    `/api/profiles/${id}/suites/private`,
    '/api/profiles/not-an-id',
  ])('keeps anonymous requests out of %s', async (path) => {
    const f = fixture(path);
    await expect(f.run()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.next).not.toHaveBeenCalled();
  });
  it.each(['POST', 'PUT', 'DELETE', 'HEAD'])(
    'does not make profile %s anonymous',
    async (method) => {
      await expect(
        fixture(`/api/profiles/${id}`, {}, method).run()
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        fixture(`/api/profiles/${id}/favorites`, {}, method).run()
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        fixture(`/api/profiles/${id}/suites`, {}, method).run()
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  );
  it.each([
    'authorization',
    'x-user-id',
    'x-user-claims',
    'x-user-email',
    'x-auth-time',
  ])('rejects mixed anonymous and supplied session header %s', async (name) => {
    await expect(
      fixture(`/api/profiles/${id}`, { [name]: 'invalid' }).run()
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('never treats an inactive supplied identity as an anonymous public reader', async () => {
    const f = fixture(`/api/profiles/${id}`, {
      'x-anonymous': 'false',
      'x-user-id': 'Uid',
    });
    f.find.mockResolvedValue(null);
    await expect(f.run()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.next).not.toHaveBeenCalled();
  });
  it('requires trusted ingress even for public information', async () => {
    await expect(
      fixture('/api/profiles', { 'x-ingress-auth': 'forged' }).run()
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('rejects duplicate authentication headers', async () => {
    const f = fixture('/api/profiles');
    f.request.rawHeaders = ['X-Anonymous', 'true', 'X-Anonymous', 'true'];
    await expect(f.run()).rejects.toBeInstanceOf(BadRequestException);
  });
});
