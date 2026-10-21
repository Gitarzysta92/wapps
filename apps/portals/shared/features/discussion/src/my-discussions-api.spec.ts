import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { MY_DISCUSSIONS_ORIGIN } from './application/my-discussions.port';
import { MyDiscussionsApiService } from './infrastructure/my-discussions-api.service';

const id = '10000000-0000-4000-8000-000000000001';
const appId = '10000000-0000-4000-8000-000000000002';
const entry = {
  id,
  applicationId: appId,
  title: 'Topic',
  createdAt: 1,
  replyCount: 2,
  participation: 'author',
};
const app = {
  id: appId,
  revision: 1,
  slug: 'current-application',
  name: 'Current Application',
  description: null,
  website: null,
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
  categories: [],
  tags: [],
  devices: [],
  platforms: [],
  monetizations: [],
  reviews: null,
};

describe('My Discussions API and catalog boundary', () => {
  let api: MyDiscussionsApiService,
    http: HttpTestingController,
    token: BehaviorSubject<string | null>;
  beforeEach(() => {
    token = new BehaviorSubject<string | null>('Alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MyDiscussionsApiService,
        { provide: MY_DISCUSSIONS_ORIGIN, useValue: '' },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
      ],
    });
    api = TestBed.inject(MyDiscussionsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('resolves current canonical app metadata once per app without sending identity filters', async () => {
    const pending = firstValueFrom(api.list(null));
    const list = http.expectOne('/api/me/discussions');
    expect(list.request.method).toBe('GET');
    list.flush({ items: [entry, { ...entry, id: appId }], next: null });
    http
      .expectOne(`/api/catalog/app-selection?ids=${appId}`)
      .flush({ items: [app] });
    const result = await pending;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(2);
      expect(result.value.items[0]).toMatchObject({
        applicationName: app.name,
        applicationSlug: app.slug,
      });
    }
  });
  it('omits withdrawn applications but preserves the bounded continuation', async () => {
    const pending = firstValueFrom(api.list(null));
    http
      .expectOne('/api/me/discussions')
      .flush({ items: [entry], next: `1.${id}` });
    http
      .expectOne(`/api/catalog/app-selection?ids=${appId}`)
      .flush({ items: [] });
    expect(await pending).toMatchObject({
      ok: true,
      value: { items: [], next: `1.${id}` },
    });
  });
  it.each([503, 401, 403])(
    'does not fabricate empty success on HTTP %i',
    async (status) => {
      const pending = firstValueFrom(api.list(null));
      http
        .expectOne('/api/me/discussions')
        .flush({}, { status, statusText: 'Unavailable' });
      expect((await pending).ok).toBe(false);
    }
  );
  it('rejects malformed membership and catalog injection instead of fabricating links', async () => {
    let pending = firstValueFrom(api.list(null));
    http
      .expectOne('/api/me/discussions')
      .flush({ items: [{ ...entry, ownerIdentityId: 'private' }], next: null });
    expect((await pending).ok).toBe(false);
    pending = firstValueFrom(api.list(null));
    http.expectOne('/api/me/discussions').flush({ items: [entry], next: null });
    http
      .expectOne(`/api/catalog/app-selection?ids=${appId}`)
      .flush({ items: [{ ...app, id }] });
    expect((await pending).ok).toBe(false);
  });
  it('fences both request stages on account change and sends nothing without a session', async () => {
    let pending = firstValueFrom(api.list(null));
    token.next('Bob');
    http.expectOne('/api/me/discussions').flush({ items: [entry], next: null });
    expect((await pending).ok).toBe(false);
    pending = firstValueFrom(api.list(null));
    http.expectOne('/api/me/discussions').flush({ items: [entry], next: null });
    token.next(null);
    http
      .expectOne(`/api/catalog/app-selection?ids=${appId}`)
      .flush({ items: [app] });
    expect((await pending).ok).toBe(false);
    expect((await firstValueFrom(api.list(null))).ok).toBe(false);
  });
  it('requires valid cursors before issuing requests and retains empty continuation pages', async () => {
    expect((await firstValueFrom(api.list('invalid'))).ok).toBe(false);
    const pending = firstValueFrom(api.list(`1.${id}`));
    http
      .expectOne(`/api/me/discussions?cursor=1.${id}`)
      .flush({ items: [], next: `0.${id}` });
    expect(await pending).toMatchObject({
      ok: true,
      value: { items: [], next: `0.${id}` },
    });
  });
});
