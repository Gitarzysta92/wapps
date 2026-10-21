import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { type CustomerProfileDto } from '@domains/customer/profiles';
import { MyProfileService } from './application/my-profile.service';
import { MyProfileApiService } from './infrastructure/my-profile-api.service';
import { PROFILE_STORAGE_KEY } from './infrastructure/my-profile-demo.service';
import { provideMyProfileFeature } from './my-profile.providers';

const url = '/api/me/profile';
const snapshot = {
  identityId: 'AliceUid',
  revision: 2,
  registeredAt: 100,
  updatedAt: 100,
  profile: {
    name: 'Alice',
    bio: null,
    location: null,
    avatarUri: null,
    socialLinks: {},
  },
};

describe('durable private profile feature', () => {
  let token: BehaviorSubject<string | null>;
  let http: HttpTestingController;
  let service: MyProfileService;
  beforeEach(() => {
    token = new BehaviorSubject<string | null>('alice-token');
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        ...provideMyProfileFeature({
          mode: 'api',
          apiBaseUrl: '',
          avatarBaseUrl: '',
          guestProfile: { id: 'guest', name: 'Guest' },
        }).providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MyProfileService);
  });
  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  async function loaded(): Promise<CustomerProfileDto> {
    http.expectOne(url).flush(snapshot);
    await settle();
    const profile = service.getMyProfile();
    if (!profile) throw new Error('Expected loaded profile');
    return profile;
  }

  it('loads real identity and revision without fixtures, metrics or synthetic media', async () => {
    const profile = await loaded();
    expect(profile).toMatchObject({
      id: 'AliceUid',
      revision: 2,
      name: 'Alice',
    });
    expect(profile.stats).toBeUndefined();
    expect(profile.avatar).toBeUndefined();
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull();
  });
  it('loads only the explicit contact address and clears it when switching accounts', async () => {
    http.expectOne(url).flush({ ...snapshot, profile: { ...snapshot.profile, contactEmail: 'contact@example.test' } });
    await settle();
    expect(service.getMyProfile()?.contactEmail).toBe('contact@example.test');
    expect(service.getMyProfile()?.email).toBeUndefined();
    token.next('bob-token');
    expect(service.getMyProfile()).toBeNull();
    http.expectOne(url).flush({ ...snapshot, identityId: 'BobUid', profile: { ...snapshot.profile, contactEmail: null } });
    await settle();
    expect(service.getMyProfile()?.contactEmail).toBeUndefined();
  });
  it('exposes loading, failure, then explicit retry success', async () => {
    const states: { isLoading: boolean; isError: boolean }[] = [];
    service.myProfile$.subscribe((value) => states.push(value));
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.getMyProfile()).toBeNull();
    service.reload();
    await loaded();
    expect(
      states.map(({ isLoading, isError }) => [isLoading, isError])
    ).toEqual([
      [true, false],
      [false, true],
      [true, false],
      [false, false],
    ]);
  });
  it('rejects malformed server profiles without selecting browser-local data', async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, '{"id":"demo","name":"Demo"}');
    http.expectOne(url).flush({ success: true });
    await settle();
    expect(service.getMyProfile()).toBeNull();
  });
  it('does not load private state while signed out and clears memory immediately', async () => {
    await loaded();
    token.next(null);
    expect(service.getMyProfile()).toBeNull();
    http.expectNone(url);
    service.reload();
    http.expectNone(url);
  });
  it('cancels previous account reads and never retains them across a switch or failed read', async () => {
    const old = http.expectOne(url);
    token.next('bob-token');
    expect(old.cancelled).toBe(true);
    expect(service.getMyProfile()).toBeNull();
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.getMyProfile()).toBeNull();
  });
  it('discards a response from the previous session while lazy validation is pending', async () => {
    http.expectOne(url).flush({ ...snapshot, profile: { ...snapshot.profile, contactEmail: 'alice@example.test' } });
    token.next('bob-token');
    http.expectOne(url).flush({ ...snapshot, identityId: 'BobUid', profile: { ...snapshot.profile, contactEmail: 'bob@example.test' } });
    await settle();
    expect(service.getMyProfile()?.id).toBe('BobUid');
    expect(service.getMyProfile()?.contactEmail).toBe('bob@example.test');
  });
  it('rejects a save from an old account form', async () => {
    const old = await loaded();
    token.next('bob-token');
    http.expectOne(url).flush({
      ...snapshot,
      identityId: 'BobUid',
      profile: { ...snapshot.profile, name: 'Bob' },
    });
    await settle();
    expect((await firstValueFrom(service.updateProfile(old))).ok).toBe(false);
    http.expectNone((request) => request.method === 'PUT');
    expect(service.getMyProfile()?.id).toBe('BobUid');
  });
  it('cancels an in-flight save on session change without replacing the new account', async () => {
    const profile = await loaded();
    const save = firstValueFrom(
      service.updateProfile({ ...profile, name: 'Edited' })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = http.expectOne(url);
    token.next('bob-token');
    expect(request.cancelled).toBe(true);
    expect((await save).ok).toBe(false);
    http.expectOne(url).flush({ ...snapshot, identityId: 'BobUid' });
    await settle();
    expect(service.getMyProfile()?.id).toBe('BobUid');
  });
  it('retains command identity across uncertain outcomes and changes it for new intent', async () => {
    const profile = await loaded();
    const first = firstValueFrom(
      service.updateProfile({ ...profile, name: 'Edited' })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    const request = http.expectOne(url);
    const key = request.request.headers.get('Idempotency-Key');
    expect(key).toMatch(/^[a-f0-9-]{36}$/);
    expect(request.request.body).toEqual({
      expectedRevision: 2,
      name: 'Edited',
      bio: null,
      location: null,
      socialLinks: {},
      contactEmail: null,
    });
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    expect((await first).ok).toBe(false);
    const retry = firstValueFrom(
      service.updateProfile({ ...profile, name: 'Edited' })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    const repeated = http.expectOne(url);
    expect(repeated.request.headers.get('Idempotency-Key')).toBe(key);
    repeated.flush({}, { status: 503, statusText: 'Unavailable' });
    await retry;
    const changed = firstValueFrom(
      service.updateProfile({ ...profile, name: 'New intent' })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    const next = http.expectOne(url);
    expect(next.request.headers.get('Idempotency-Key')).not.toBe(key);
    next.flush({ identityId: 'AliceUid', revision: 3 });
    http.expectOne(url).flush({
      ...snapshot,
      revision: 3,
      profile: { ...snapshot.profile, name: 'New intent' },
    });
    await settle();
    expect((await changed).ok).toBe(true);
    expect(service.getMyProfile()?.revision).toBe(3);
  });
  it('preserves loaded content after a conflict and requires an exact receipt', async () => {
    const profile = await loaded();
    const save = firstValueFrom(
      service.updateProfile({ ...profile, name: 'Edited' })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(url).flush({}, { status: 409, statusText: 'Conflict' });
    expect(await save).toMatchObject({
      ok: false,
      error: { reason: 'conflict' },
    });
    expect(service.getMyProfile()).toEqual(profile);
    const retry = firstValueFrom(
      service.updateProfile({ ...profile, name: 'Edited' })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(url).flush({ identityId: 'Other', revision: 3 });
    expect((await retry).ok).toBe(false);
    expect(service.getMyProfile()).toEqual(profile);
  });
  it('rejects invalid input before HTTP', async () => {
    const profile = await loaded();
    expect(
      (
        await firstValueFrom(
          TestBed.inject(MyProfileApiService).update({ ...profile, name: '' })
        )
      ).ok
    ).toBe(false);
    http.expectNone((request) => request.method === 'PUT');
  });
  it('does not confirm unsupported avatar changes as a text save', async () => {
    const profile = await loaded();
    const result = await firstValueFrom(
      service.updateProfile({
        ...profile,
        avatar: { uri: 'data:image/png;base64,eA==', alt: 'Alice' },
      })
    );
    expect(result).toMatchObject({ ok: false, error: { reason: 'invalid' } });
    http.expectNone((request) => request.method === 'PUT');
  });
  it('loads private photos through authenticated HTTP and revokes object URLs across reload/session changes', async () => {
    const create = jest.fn().mockReturnValue('blob:private-photo');
    const revoke = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
    const avatarId = '00000000-0000-0000-0000-000000000001';
    http.expectOne(url).flush({ ...snapshot, profile: { ...snapshot.profile, avatarId } });
    await settle();
    expect(service.getMyProfile()).toBeNull();
    const request = http.expectOne(`${url}/avatar/${avatarId}`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob([new Uint8Array(16)], { type: 'image/webp' }));
    expect(service.getMyProfile()?.avatar?.uri).toBe('blob:private-photo');
    token.next(null);
    expect(revoke).toHaveBeenCalledWith('blob:private-photo');
    expect(service.getMyProfile()).toBeNull();
  });
  it('cancels an old private photo read during a session change', async () => {
    const avatarId = '00000000-0000-0000-0000-000000000001';
    http.expectOne(url).flush({ ...snapshot, profile: { ...snapshot.profile, avatarId } });
    await settle();
    const request = http.expectOne(`${url}/avatar/${avatarId}`);
    token.next('bob-token');
    expect(request.cancelled).toBe(true);
    http.expectOne(url).flush({ ...snapshot, identityId: 'BobUid' });
    await settle();
    expect(service.getMyProfile()?.avatar).toBeUndefined();
    expect(service.getMyProfile()?.id).toBe('BobUid');
  });
  it('fails explicitly when a private image cannot be read or has an invalid response type', async () => {
    const avatarId = '00000000-0000-0000-0000-000000000001';
    http.expectOne(url).flush({ ...snapshot, profile: { ...snapshot.profile, avatarId } });
    await settle();
    http.expectOne(`${url}/avatar/${avatarId}`).flush(new Blob(['<html>not a photo</html>'], { type: 'text/html' }));
    expect(service.getMyProfile()).toBeNull();
  });
});
