import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AuthenticationInterceptor } from './authentication.interceptor';
import { AUTHENTICATION_SESSION } from '../application/authentication-session.port';
import { AUTHENTICATION_HANDLER } from '../application/authentication-handler.token';
import { AUTHENTICATION_RECOVERY_CONTROL } from '../application/authentication-recovery-control';

describe('Authentication interceptor', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let token: string;
  const handler = { refreshToken: jest.fn() };
  const storage = {
    getToken: () => token,
    setToken: jest.fn((v: string) => {
      token = v;
    }),
    clear: jest.fn(),
  };
  beforeEach(() => {
    token = 'old';
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthenticationInterceptor,
          multi: true,
        },
        { provide: AUTHENTICATION_SESSION, useValue: storage },
        { provide: AUTHENTICATION_HANDLER, useValue: handler },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
      ],
    });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => requests.verify());
  it('shares refresh across concurrent 401s and retries with the token value', () => {
    const refresh = new Subject<
      { ok: true; value: string } | { ok: false; error: Error }
    >();
    handler.refreshToken.mockReturnValue(refresh);
    http.get('/one').subscribe();
    http.get('/two').subscribe();
    requests
      .expectOne('/one')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    requests
      .expectOne('/two')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handler.refreshToken).toHaveBeenCalledTimes(1);
    refresh.next({ ok: true, value: 'new' });
    refresh.complete();
    for (const url of ['/one', '/two']) {
      const retry = requests.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
      retry.flush({});
    }
  });
  it('does not refresh recursively for authentication endpoints', () => {
    http.post('/auth/refresh', {}).subscribe({ error: () => undefined });
    requests
      .expectOne('/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handler.refreshToken).not.toHaveBeenCalled();
  });
  it('does not retry an old request under a newly signed-in session', () => {
    http.put('/profile', {}).subscribe({ error: () => undefined });
    token = 'other-user';
    requests
      .expectOne('/profile')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handler.refreshToken).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
    requests.expectNone('/profile');
  });
  it('does not replace or clear a new session when an old refresh finishes', () => {
    const refresh = new Subject<{ ok: true; value: string }>();
    handler.refreshToken.mockReturnValue(refresh);
    http.put('/profile', {}).subscribe({ error: () => undefined });
    requests
      .expectOne('/profile')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    token = 'other-user';
    refresh.next({ ok: true, value: 'old-user-refreshed' });
    refresh.complete();
    expect(token).toBe('other-user');
    expect(storage.setToken).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
    requests.expectNone('/profile');
  });
  it('does not clear a new session when the old retry fails', () => {
    handler.refreshToken.mockReturnValue(of({ ok: true, value: 'refreshed' }));
    http.get('/one').subscribe({ error: () => undefined });
    requests
      .expectOne('/one')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    const retry = requests.expectOne('/one');
    token = 'other-user';
    retry.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(storage.clear).not.toHaveBeenCalled();
  });
  it('clears the session when refresh fails', () => {
    handler.refreshToken.mockReturnValue(
      of({ ok: false, error: new Error('expired') })
    );
    http.get('/one').subscribe({ error: () => undefined });
    requests
      .expectOne('/one')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(storage.clear).toHaveBeenCalled();
  });
  it('does not send a token to an unrelated origin', () => {
    http.get('https://external.example/resource').subscribe();
    const request = requests.expectOne('https://external.example/resource');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
  it('keeps background 401s from navigating or refreshing while deletion is awaiting a receipt', () => {
    const control = TestBed.inject(AUTHENTICATION_RECOVERY_CONTROL);
    control.hold = { token: 'old' };
    http.get('/api/me/exports').subscribe({ error: () => undefined });
    requests
      .expectOne('/api/me/exports')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handler.refreshToken).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
    control.hold = null;
    handler.refreshToken.mockReturnValue(of({ ok: true, value: 'refreshed' }));
    http.get('/api/me').subscribe();
    requests
      .expectOne('/api/me')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/api/me').flush({});
    expect(handler.refreshToken).toHaveBeenCalledTimes(1);
  });
  it('discards refresh already in flight when an account-deletion hold starts', () => {
    const refresh = new Subject<{ ok: true; value: string }>();
    handler.refreshToken.mockReturnValue(refresh);
    http.get('/api/me/exports').subscribe({ error: () => undefined });
    requests
      .expectOne('/api/me/exports')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    TestBed.inject(AUTHENTICATION_RECOVERY_CONTROL).hold = { token: 'old' };
    refresh.next({ ok: true, value: 'refreshed' });
    refresh.complete();
    expect(storage.setToken).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
    requests.expectNone('/api/me/exports');
  });
});
