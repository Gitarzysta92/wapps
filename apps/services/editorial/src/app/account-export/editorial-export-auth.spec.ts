import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  EditorialAuthMiddleware,
  type EditorialRequest,
} from '../http/editorial-auth';

describe('Editorial export credential separation', () => {
  const secret = 's'.repeat(48);
  const invoke = (
    headers: Record<string, string | string[]> = {
      'x-account-export-reader': secret,
    },
    options: {
      path?: string;
      method?: string;
      configured?: string;
      ingress?: string;
      rawHeaders?: string[];
    } = {}
  ) => {
    const request = {
      headers,
      rawHeaders:
        options.rawHeaders ??
        Object.entries(headers).flatMap(([key, value]) => [key, String(value)]),
      originalUrl: options.path ?? '/api/internal/account-export',
      method: options.method ?? 'POST',
      editorialActor: null,
    } as EditorialRequest;
    const next = jest.fn();
    new EditorialAuthMiddleware(
      new ConfigService({
        INGRESS_AUTH_SECRET: options.ingress ?? 'ingress',
        ACCOUNT_EXPORT_SOURCE_SECRET: options.configured ?? secret,
      })
    ).use(request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    return request.editorialActor;
  };
  it('creates only the fixed service principal', () => {
    expect(invoke()).toEqual({
      identityId: 'wapps-account-export-reader',
      tenantId: 'account-export',
      roles: ['account-export:reader'],
    });
  });
  it.each([
    'authorization',
    'x-ingress-auth',
    'x-profile-reader',
    'x-user-id',
    'x-user-email',
    'x-user-claims',
    'x-auth-time',
    'x-anonymous',
    'x-tenant-id',
    'x-roles',
  ])('rejects mixed %s credentials before assigning an actor', (header) => {
    expect(() =>
      invoke({ 'x-account-export-reader': secret, [header]: 'value' })
    ).toThrow('authentication required');
  });
  it('rejects duplicate and array credentials', () => {
    expect(() =>
      invoke(undefined, {
        rawHeaders: [
          'X-Account-Export-Reader',
          secret,
          'x-account-export-reader',
          secret,
        ],
      })
    ).toThrow('Duplicate');
    expect(() =>
      invoke({ 'x-account-export-reader': [secret, secret] })
    ).toThrow('Invalid');
  });
  it.each([
    '',
    'short',
    'ingress',
    'x'.repeat(129),
    'secret with spaces'.repeat(3),
  ])('rejects missing/invalid/shared configuration (%s)', (configured) => {
    expect(() => invoke(undefined, { configured })).toThrow(
      'authentication required'
    );
  });
  it('rejects reuse of a valid ingress secret', () => {
    expect(() =>
      invoke(undefined, { configured: secret, ingress: secret })
    ).toThrow('authentication required');
  });
  it('rejects wrong methods and credential use on ordinary/profile routes', () => {
    expect(() => invoke(undefined, { method: 'GET' })).toThrow(
      'authentication required'
    );
    for (const path of ['/api/apps', '/api/internal/profile-suites'])
      expect(() => invoke(undefined, { path })).toThrow(
        'authentication required'
      );
  });
});
