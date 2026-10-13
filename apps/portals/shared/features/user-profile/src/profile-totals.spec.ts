import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ok, err } from '@sdk/kernel/standard';
import {
  PROFILE_TOTALS_PORT,
  PROFILE_TOTALS_SESSION,
  PROFILE_TOTALS_URL,
} from './application/profile-totals.port';
import { ProfileTotalsService } from './application/profile-totals.service';
import { ProfileTotalsApiService } from './infrastructure/profile-totals-api.service';
import { PublicProfileError } from './application/public-profile.port';
const value = { discussions: 32, favorites: 0, suites: 24, articles: 41 };
afterEach(() => TestBed.resetTestingModule());
describe('profile total session state', () => {
  function fixture() {
    const session = new BehaviorSubject<string | null>('owner');
    const port = { read: jest.fn().mockReturnValue(of(ok(value))) };
    TestBed.configureTestingModule({
      providers: [
        ProfileTotalsService,
        { provide: PROFILE_TOTALS_PORT, useValue: port },
        {
          provide: PROFILE_TOTALS_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    return { port, session, service: TestBed.inject(ProfileTotalsService) };
  }
  it('loads private or selected public totals and refreshes them', () => {
    const f = fixture();
    f.service.open(null);
    expect(f.port.read).toHaveBeenCalledWith(null);
    expect(f.service.value()).toEqual(value);
    f.service.open('profile');
    expect(f.port.read).toHaveBeenLastCalledWith('profile');
    f.service.reload();
    expect(f.port.read).toHaveBeenCalledTimes(3);
  });
  it('cancels stale requests and clears totals on session or target changes', () => {
    const f = fixture(),
      first = new Subject(),
      second = new Subject();
    f.port.read.mockReturnValueOnce(first).mockReturnValueOnce(second);
    f.service.open(null);
    f.session.next('other');
    first.next(ok(value));
    expect(f.service.value()).toBeNull();
    expect(f.service.status()).toBe('loading');
    second.next(ok(value));
    expect(f.service.value()).toEqual(value);
    f.port.read.mockReturnValue(new Subject());
    f.service.open('other-profile');
    expect(f.service.value()).toBeNull();
  });
  it('does not retain a stale number when a refresh fails', () => {
    const f = fixture();
    f.service.open(null);
    f.port.read.mockReturnValue(
      of(err(new PublicProfileError('unavailable', 'Down')))
    );
    f.service.reload();
    expect(f.service.value()).toBeNull();
    expect(f.service.status()).toBe('unavailable');
  });
});
describe('profile totals HTTP adapter', () => {
  function fixture() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileTotalsApiService,
        { provide: PROFILE_TOTALS_URL, useValue: '' },
      ],
    });
    return {
      api: TestBed.inject(ProfileTotalsApiService),
      http: TestBed.inject(HttpTestingController),
    };
  }
  it('parses complete private counts and public hidden values', fakeAsync(() => {
    const f = fixture(),
      received = jest.fn();
    f.api.read(null).subscribe(received);
    flushMicrotasks();
    f.http.expectOne('/api/me/totals').flush(value);
    expect(received).toHaveBeenLastCalledWith(ok(value));
    f.api.read('member').subscribe(received);
    flushMicrotasks();
    f.http
      .expectOne('/api/profiles/member/totals')
      .flush({ ...value, suites: null });
    expect(received).toHaveBeenLastCalledWith(ok({ ...value, suites: null }));
    f.http.verify();
  }));
  it('rejects incomplete private or malformed public responses', fakeAsync(() => {
    const f = fixture(),
      received = jest.fn();
    f.api.read(null).subscribe(received);
    flushMicrotasks();
    f.http.expectOne('/api/me/totals').flush({ ...value, suites: null });
    expect(received.mock.calls[0][0].ok).toBe(false);
    f.api.read('member').subscribe(received);
    flushMicrotasks();
    f.http
      .expectOne('/api/profiles/member/totals')
      .flush({ ...value, favorites: '0' });
    expect(received.mock.calls[1][0].ok).toBe(false);
    f.http.verify();
  }));
});
