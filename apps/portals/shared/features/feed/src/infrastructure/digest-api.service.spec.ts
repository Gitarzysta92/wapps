import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { DigestApiService } from './digest-api.service';
import { DIGEST_URL } from '../application/digest.port';

describe('Digest API adapter', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DigestApiService,
        { provide: DIGEST_URL, useValue: '' },
      ],
    })
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('reads the strict independent groups without caller scope', async () => {
    const result = firstValueFrom(TestBed.inject(DigestApiService).read());
    const request = TestBed.inject(HttpTestingController).expectOne(
      '/api/digest'
    );
    expect(request.request.method).toBe('GET');
    request.flush(
      Object.fromEntries(
        ['latest', 'articles', 'applications', 'discussions'].map((key) => [
          key,
          { items: [], more: false },
        ])
      )
    );
    expect((await result).ok).toBe(true);
  });
  it('rejects malformed or unavailable selections instead of supplying empty content', async () => {
    const result = firstValueFrom(TestBed.inject(DigestApiService).read());
    TestBed.inject(HttpTestingController)
      .expectOne('/api/digest')
      .flush({ latest: { items: [], through: 'private' } });
    expect((await result).ok).toBe(false);
    const failure = firstValueFrom(TestBed.inject(DigestApiService).read());
    TestBed.inject(HttpTestingController)
      .expectOne('/api/digest')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect((await failure).ok).toBe(false);
  });
});
