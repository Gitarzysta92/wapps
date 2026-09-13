import { TestBed } from '@angular/core/testing';
import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AuthenticationInterceptor } from './authentication.interceptor';
import { AuthenticationStorage } from './authentication.storage';
import { AUTHENTICATION_HANDLER } from '../application/authentication-handler.token';

describe('Authentication interceptor', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let token: string;
  const handler = { refreshToken: jest.fn() };
  const storage = { getToken: () => token, setToken: jest.fn((v: string) => { token = v; }), clear: jest.fn() };
  beforeEach(() => {
    token = 'old'; jest.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting(),
      { provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true },
      { provide: AuthenticationStorage, useValue: storage },
      { provide: AUTHENTICATION_HANDLER, useValue: handler },
      { provide: Router, useValue: { navigateByUrl: jest.fn() } },
    ] });
    http = TestBed.inject(HttpClient); requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => requests.verify());
  it('shares refresh across concurrent 401s and retries with the token value', () => {
    const refresh = new Subject<any>(); handler.refreshToken.mockReturnValue(refresh);
    http.get('/one').subscribe(); http.get('/two').subscribe();
    requests.expectOne('/one').flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne('/two').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handler.refreshToken).toHaveBeenCalledTimes(1);
    refresh.next({ ok: true, value: 'new' }); refresh.complete();
    for (const url of ['/one', '/two']) {
      const retry = requests.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new'); retry.flush({});
    }
  });
  it('does not refresh recursively for authentication endpoints', () => {
    http.post('/auth/refresh', {}).subscribe({ error: () => undefined });
    requests.expectOne('/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(handler.refreshToken).not.toHaveBeenCalled();
  });
  it('clears the session when refresh fails', () => {
    handler.refreshToken.mockReturnValue(of({ ok: false, error: new Error('expired') }));
    http.get('/one').subscribe({ error: () => undefined });
    requests.expectOne('/one').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(storage.clear).toHaveBeenCalled();
  });
  it('does not send a token to an unrelated origin', () => {
    http.get('https://external.example/resource').subscribe();
    const request = requests.expectOne('https://external.example/resource');
    expect(request.request.headers.has('Authorization')).toBe(false); request.flush({});
  });
});
