import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AUTHENTICATION_SESSION } from '../application/authentication-session.port';
import { AUTHENTICATION_HANDLER } from '../application/authentication-handler.token';
import {
  AccountErasureApiService,
  accountErasureEndpoint,
} from './account-erasure-api.service';
import { AuthenticationInterceptor } from './authentication.interceptor';
import { provideAccountErasure } from '../account-erasure.providers';

describe('account erasure HTTP boundary', () => {
  let service: AccountErasureApiService, http: HttpTestingController;
  const refreshToken = jest.fn(),
    clear = jest.fn(),
    navigateByUrl = jest.fn();
  const receipt = {
    identityId: 'Alice',
    revision: 2,
    status: 'accepted',
    cleanup: 'pending',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        ...provideAccountErasure(''),
        AccountErasureApiService,
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthenticationInterceptor,
          multi: true,
        },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { getToken: () => 'alice-token', clear },
        },
        { provide: AUTHENTICATION_HANDLER, useValue: { refreshToken } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    service = TestBed.inject(AccountErasureApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads canonical identity for confirmation then sends only self DELETE', async () => {
    const prepare = firstValueFrom(service.prepare());
    http.expectOne('/api/me').flush({
      identityId: 'Alice',
      account: { status: 'ACTIVE' },
      profile: { name: 'Alice A.' },
    });
    expect(await prepare).toEqual({
      ok: true,
      value: { identityId: 'Alice', name: 'Alice A.' },
    });
    const deletion = firstValueFrom(service.request('Alice'));
    const request = http.expectOne('/api/me');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer alice-token'
    );
    request.flush(receipt, { status: 202, statusText: 'Accepted' });
    expect(await deletion).toEqual({ ok: true, value: receipt });
  });
  it.each([
    { ...receipt, identityId: 'Bob' },
    { ...receipt, revision: 0 },
    { ...receipt, revision: '2' },
    { ...receipt, cleanup: 'ready' },
    { ...receipt, status: 'completed' },
    { ...receipt, privateData: 'unexpected' },
    { identityId: 'Alice', revision: 2, status: 'accepted' },
    null,
  ])('does not accept malformed/mismatched receipt %p', async (value) => {
    const result = firstValueFrom(service.request('Alice'));
    http
      .expectOne('/api/me')
      .flush(value, { status: 202, statusText: 'Accepted' });
    expect(await result).toMatchObject({ ok: false });
  });
  it.each([200, 204, 400, 401, 403, 409, 503])(
    'does not refresh, navigate or retry after status %s',
    async (status) => {
      const result = firstValueFrom(service.request('Alice'));
      http.expectOne('/api/me').flush(status === 204 ? null : receipt, {
        status,
        statusText: 'Test response',
      });
      expect(await result).toMatchObject({ ok: false });
      expect(refreshToken).not.toHaveBeenCalled();
      expect(clear).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
      http.expectNone('/api/me');
    }
  );
  it('bounds an unresponsive request and reports it unconfirmed', fakeAsync(() => {
    const next = jest.fn();
    service.request('Alice').subscribe(next);
    const request = http.expectOne('/api/me');
    tick(15_001);
    expect(request.cancelled).toBe(true);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(refreshToken).not.toHaveBeenCalled();
  }));
  it.each([
    null,
    { identityId: 'Alice' },
    {
      identityId: 'Alice',
      account: { status: ['ACTIVE'] },
      profile: { name: 'Alice' },
    },
    {
      identityId: 'Alice',
      account: { status: 'DELETED' },
      profile: { name: 'Alice' },
    },
  ])('rejects an unverified current account %p', async (value) => {
    const result = firstValueFrom(service.prepare());
    http.expectOne('/api/me').flush(value);
    expect(await result).toMatchObject({ ok: false });
  });
  it.each([
    'https://example.test/path',
    'https://user:pass@example.test',
    'https://example.test?tenant=other',
    'file:///tmp',
  ])('rejects ambiguous API configuration %s', (url) => {
    expect(() => accountErasureEndpoint(url)).toThrow();
  });
});
