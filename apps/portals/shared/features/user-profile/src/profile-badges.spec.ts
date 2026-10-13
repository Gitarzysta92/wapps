import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  PROFILE_BADGES_PORT,
  PROFILE_BADGES_SESSION,
  PROFILE_BADGES_URL,
} from './application/profile-badges.port';
import { ProfileBadgeAdminService } from './application/profile-badge-admin.service';
import { ProfileBadgeDisplayService } from './application/profile-badge-display.service';
import { ProfileBadgesApiService } from './infrastructure/profile-badges-api.service';
import { PublicProfileError } from './application/public-profile.port';

const id = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const profile = {
  profileId: id,
  name: 'Member',
  active: true,
  revision: 0,
  badges: [],
  events: [],
  after: null,
};
const value = {
  sharing: 'visible',
  items: [{ kind: 'verified', awardedAt: 100 }],
};
const command = {
  expectedRevision: 0,
  kind: 'verified' as const,
  action: 'award' as const,
  reason: 'Evidence reviewed',
};

describe('profile badge session and command state', () => {
  function fixture() {
    const session = new BehaviorSubject<string | null>('staff');
    const port = {
      capabilities: jest.fn().mockReturnValue(of(ok(undefined))),
      administer: jest.fn().mockReturnValue(of(ok(profile))),
      change: jest
        .fn()
        .mockReturnValue(
          of(err(new PublicProfileError('unavailable', 'Unknown result')))
        ),
      read: jest.fn().mockReturnValue(of(ok(value))),
    };
    TestBed.configureTestingModule({
      providers: [
        ProfileBadgeAdminService,
        ProfileBadgeDisplayService,
        { provide: PROFILE_BADGES_PORT, useValue: port },
        {
          provide: PROFILE_BADGES_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    return {
      session,
      port,
      service: TestBed.inject(ProfileBadgeAdminService),
      display: TestBed.inject(ProfileBadgeDisplayService),
    };
  }
  afterEach(() => TestBed.resetTestingModule());
  it('requires successful capability authorization before staff reads', () => {
    const f = fixture();
    f.port.capabilities.mockReturnValue(
      of(err(new PublicProfileError('denied', 'Forbidden')))
    );
    f.service.checkAccess();
    f.service.target.set(id);
    f.service.open();
    expect(f.service.access()).toBe('denied');
    expect(f.port.administer).not.toHaveBeenCalled();
  });
  it('retains the exact command and key during uncertain retry, blocking new intent', () => {
    const f = fixture();
    f.service.target.set(id);
    f.service.open();
    f.service.reason.set(command.reason);
    f.service.change('verified', 'award');
    const call = f.port.change.mock.calls[0];
    expect(call[0]).toBe(id);
    expect(call[1]).toEqual(command);
    expect(f.service.uncertain()).toBe(true);
    f.service.reason.set('Different reason');
    f.service.change('premium', 'award');
    f.service.open();
    expect(f.port.change).toHaveBeenCalledTimes(1);
    expect(f.port.administer).toHaveBeenCalledTimes(1);
    f.port.change.mockReturnValue(of(ok({ revision: 1 })));
    f.service.retry();
    expect(f.port.change.mock.calls[1]).toEqual(call);
    expect(f.service.uncertain()).toBe(false);
    expect(f.service.reason()).toBe('');
    expect(f.port.administer).toHaveBeenCalledTimes(2);
  });
  it('clears staff history, reasons and pending commands on session changes', () => {
    const f = fixture(),
      pending = new Subject();
    f.service.target.set(id);
    f.service.open();
    f.service.reason.set(command.reason);
    f.port.change.mockReturnValue(pending);
    f.service.change('verified', 'award');
    f.session.next('other-member');
    expect(f.service.profile()).toBeNull();
    expect(f.service.reason()).toBe('');
    expect(f.service.target()).toBe('');
    pending.next(ok({ revision: 1 }));
    expect(f.service.feedback()).toBe('');
    expect(f.service.saving()).toBe(false);
    f.service.retry();
    expect(f.port.change).toHaveBeenCalledTimes(1);
  });
  it('clears history on load failure and blocks conflict until reload', () => {
    const f = fixture();
    f.service.target.set(id);
    f.service.open();
    f.service.reason.set(command.reason);
    f.port.change.mockReturnValue(
      of(err(new PublicProfileError('conflict', 'Changed')))
    );
    f.service.change('verified', 'award');
    expect(f.service.conflict()).toBe(true);
    f.service.change('premium', 'award');
    expect(f.port.change).toHaveBeenCalledTimes(1);
    f.port.administer.mockReturnValue(
      of(err(new PublicProfileError('unavailable', 'Offline')))
    );
    f.service.open();
    expect(f.service.profile()).toBeNull();
    expect(f.service.status()).toBe('unavailable');
    f.port.administer.mockReturnValue(of(ok(profile)));
    f.service.open();
    expect(f.service.conflict()).toBe(false);
  });
  it('cancels old target reads and follows the confirmed target for history', () => {
    const f = fixture(),
      pending = new Subject();
    f.port.administer.mockReturnValueOnce(pending);
    f.service.target.set(actorId);
    f.service.open();
    f.service.target.set(id);
    f.service.open();
    pending.next(ok({ ...profile, profileId: actorId }));
    expect(f.service.profile()?.profileId).toBe(id);
    f.service.target.set(actorId);
    f.service.open(20);
    expect(f.port.administer).toHaveBeenLastCalledWith(id, 20);
  });
  it('requires a reason before attempting a write', () => {
    const f = fixture();
    f.service.target.set(id);
    f.service.open();
    f.service.change('verified', 'award');
    expect(f.port.change).not.toHaveBeenCalled();
    expect(f.service.feedback()).toContain('reason');
  });
  it('displays true empty/hidden states and clears obsolete values on reload or error', () => {
    const f = fixture();
    f.display.open(id);
    expect(f.display.value()).toEqual(value);
    const pending = new Subject();
    f.port.read.mockReturnValueOnce(pending);
    f.display.reload();
    expect(f.display.value()).toBeNull();
    expect(f.display.status()).toBe('loading');
    pending.next(err(new PublicProfileError('missing', 'Private')));
    expect(f.display.status()).toBe('unavailable');
    expect(f.display.value()).toBeNull();
    f.port.read.mockReturnValue(of(ok({ sharing: 'hidden', items: [] })));
    f.display.reload();
    expect(f.display.value()?.sharing).toBe('hidden');
    f.port.read.mockReturnValue(of(ok({ sharing: 'visible', items: [] })));
    f.display.open(null);
    expect(f.port.read).toHaveBeenLastCalledWith(null);
    expect(f.display.value()?.items).toEqual([]);
  });
  it('cancels stale badge results after session, target or component changes', () => {
    const f = fixture(),
      first = new Subject(),
      second = new Subject();
    f.port.read.mockReturnValueOnce(first).mockReturnValueOnce(second);
    f.display.open(id);
    f.session.next('other');
    first.next(ok(value));
    expect(f.display.value()).toBeNull();
    f.display.open(actorId);
    second.next(ok({ sharing: 'hidden', items: [] }));
    expect(f.display.value()).toEqual(value);
    TestBed.resetTestingModule();
    expect(first.observed).toBe(false);
    expect(second.observed).toBe(false);
  });
});

describe('profile badge HTTP adapter', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileBadgesApiService,
        { provide: PROFILE_BADGES_URL, useValue: '' },
      ],
    })
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it('reads own and public badge routes and rejects private audit fields', fakeAsync(() => {
    const api = TestBed.inject(ProfileBadgesApiService),
      http = TestBed.inject(HttpTestingController),
      results: unknown[] = [];
    api.read(null).subscribe((result) => results.push(result));
    flushMicrotasks();
    http.expectOne('/api/me/badges').flush(value);
    expect(results[0]).toEqual(ok(value));
    api.read(id).subscribe((result) => results.push(result));
    flushMicrotasks();
    http
      .expectOne(`/api/profiles/${id}/badges`)
      .flush({
        ...value,
        items: [{ ...value.items[0], reason: 'Private reason' }],
      });
    expect(results[1]).toEqual(err(expect.any(PublicProfileError)));
  }));
  it('validates capability responses and sends exact command keys', fakeAsync(() => {
    const api = TestBed.inject(ProfileBadgesApiService),
      http = TestBed.inject(HttpTestingController),
      results: unknown[] = [];
    api.capabilities().subscribe((result) => results.push(result));
    http
      .expectOne('/api/admin/profile-badges')
      .flush({ kinds: ['verified', 'premium'] });
    expect(results[0]).toEqual(ok(undefined));
    api
      .change(id, command, 'same-key')
      .subscribe((result) => results.push(result));
    flushMicrotasks();
    const request = http.expectOne(`/api/admin/profile-badges/${id}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-key');
    expect(request.request.body).toEqual(command);
    const event = {
      profileId: id,
      actorId,
      revision: 1,
      at: 100,
      kind: 'verified',
      action: 'award',
      reason: command.reason,
    };
    request.flush(event);
    expect(results[1]).toEqual(ok(event));
  }));
  it('rejects mismatched audit scope and command receipts', fakeAsync(() => {
    const api = TestBed.inject(ProfileBadgesApiService),
      http = TestBed.inject(HttpTestingController),
      results: unknown[] = [];
    api.administer(id, null).subscribe((result) => results.push(result));
    flushMicrotasks();
    http
      .expectOne(`/api/admin/profile-badges/${id}`)
      .flush({ ...profile, profileId: actorId });
    api
      .change(id, command, 'same-key')
      .subscribe((result) => results.push(result));
    flushMicrotasks();
    http
      .expectOne(`/api/admin/profile-badges/${id}`)
      .flush({
        profileId: id,
        actorId,
        revision: 1,
        at: 100,
        kind: 'verified',
        action: 'revoke',
        reason: command.reason,
      });
    expect(results).toEqual([
      err(expect.any(PublicProfileError)),
      err(expect.any(PublicProfileError)),
    ]);
  }));
});
