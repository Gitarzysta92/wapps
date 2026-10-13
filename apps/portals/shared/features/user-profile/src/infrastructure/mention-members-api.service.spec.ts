import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MENTION_MEMBERS_URL } from '../application/mention-members.port';
import { MentionMembersApiService } from './mention-members-api.service';

const id = '00000000-0000-4000-8000-000000000001';
const profile = {
  id,
  name: 'Visible member',
  bio: null,
  location: null,
  socialLinks: {},
  avatarId: null,
  registeredAt: 1,
};
describe('public mention member transport', () => {
  let service: MentionMembersApiService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MentionMembersApiService,
        { provide: MENTION_MEMBERS_URL, useValue: '' },
      ],
    });
    service = TestBed.inject(MentionMembersApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('selects only public IDs and names from validated directory rows', async () => {
    const pending = firstValueFrom(service.directory(null));
    http.expectOne('/api/profiles').flush({ profiles: [profile], after: null });
    expect(await pending).toEqual({
      ok: true,
      value: { items: [{ id, name: 'Visible member' }], after: null },
    });
  });
  it('does not expose hidden or deleted profiles', async () => {
    const pending = firstValueFrom(service.read(id));
    http
      .expectOne(`/api/profiles/${id}`)
      .flush({}, { status: 404, statusText: 'Missing' });
    expect(await pending).toEqual({ ok: true, value: null });
  });
  it('rejects mismatched profiles and does not fetch avatars or private credential details', async () => {
    const pending = firstValueFrom(service.read(id));
    http
      .expectOne(`/api/profiles/${id}`)
      .flush({
        access: 'visible',
        profile: { ...profile, id: id.replace(/1$/, '2') },
        isOwner: false,
        follow: null,
      });
    expect(await pending).toMatchObject({ ok: false });
    http.expectNone((request) => request.url.includes('/avatar/'));
  });
  it('rejects a nonadvancing directory page and malformed references', async () => {
    const pending = firstValueFrom(service.directory(id));
    http
      .expectOne(`/api/profiles?after=${id}`)
      .flush({ profiles: [profile], after: id });
    expect(await pending).toMatchObject({ ok: false });
    expect(await firstValueFrom(service.read('credential-uid'))).toMatchObject({
      ok: false,
    });
  });
  it('keeps dependency failures distinct from invisible members without leaking diagnostics', async () => {
    const pending = firstValueFrom(service.read(id));
    http
      .expectOne(`/api/profiles/${id}`)
      .flush({ message: 'secret' }, { status: 503, statusText: 'Unavailable' });
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain('secret');
  });
});
