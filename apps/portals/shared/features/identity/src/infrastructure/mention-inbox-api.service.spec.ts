import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MENTION_INBOX_URL } from '../application/mention-inbox.port';
import { MentionInboxApiService } from './mention-inbox-api.service';

const id = '00000000-0000-4000-8000-000000000001';
describe('mention inbox HTTP adapter', () => {
  let service: MentionInboxApiService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MentionInboxApiService,
        { provide: MENTION_INBOX_URL, useValue: '' },
      ],
    });
    service = TestBed.inject(MentionInboxApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses only the self endpoint and a strict bounded page', async () => {
    const result = firstValueFrom(service.list(`100.${id}`));
    const request = http.expectOne(
      `/api/me/notifications/mentions?cursor=100.${id}`
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(['cursor']);
    request.flush({ enabled: true, items: [], next: null });
    expect(await result).toMatchObject({
      ok: true,
      value: { enabled: true, items: [], next: null },
    });
  });
  it('rejects malformed responses and read receipts for another notification', async () => {
    const page = firstValueFrom(service.list(null));
    http
      .expectOne('/api/me/notifications/mentions')
      .flush({ enabled: true, items: [] });
    expect(await page).toMatchObject({ ok: false });
    const read = firstValueFrom(service.markRead(id));
    const request = http.expectOne('/api/me/notifications/mentions/read');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ id });
    request.flush({ id: id.replace(/1$/, '2'), readAt: 100 });
    expect(await read).toMatchObject({ ok: false });
  });
  it.each([401, 403, 409, 400, 503])(
    'keeps HTTP %s failures explicit without leaking server diagnostics',
    async (status) => {
      const pending = firstValueFrom(service.list(null));
      http
        .expectOne('/api/me/notifications/mentions')
        .flush(
          { message: 'private diagnostics' },
          { status, statusText: 'Rejected' }
        );
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error.message).not.toContain('private diagnostics');
    }
  );
  it('rejects invalid cursor or ID before sending a request', async () => {
    expect(await firstValueFrom(service.list('invalid'))).toMatchObject({
      ok: false,
    });
    expect(await firstValueFrom(service.markRead('invalid'))).toMatchObject({
      ok: false,
    });
    http.expectNone('/api/me/notifications/mentions');
    http.expectNone('/api/me/notifications/mentions/read');
  });
});
