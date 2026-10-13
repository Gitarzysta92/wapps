import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { ReviewsApiService } from './infrastructure/reviews-api.service';
import {
  REVIEWS_ORIGIN,
  ReviewRequestError,
  type ReviewAttempt,
} from './application/reviews.port';
import { provideReviews } from './reviews.providers';

const applicationId = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const content = { displayName: 'Member', rating: 4, text: 'Useful.' };
const base = `/api/application-reviews/${applicationId}`;
const review = {
  id,
  applicationId,
  content,
  revision: 2,
  contentRevision: 1,
  createdAt: 1,
  updatedAt: 1,
  withdrawn: false,
  hidden: false,
  moderationReason: null,
  helpfulCount: 1,
  helpful: true,
  reported: false,
  mine: false,
  canModerate: false,
  openReports: null,
};
const attempt: ReviewAttempt = {
  applicationId,
  id: null,
  change: { type: 'publish', expectedRevision: 0, content },
  key: 'review-command-key',
};

describe('Review HTTP boundary', () => {
  let api: ReviewsApiService,
    http: HttpTestingController,
    token: BehaviorSubject<string | null>;
  beforeEach(() => {
    token = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReviewsApiService,
        { provide: REVIEWS_ORIGIN, useValue: '' },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
      ],
    });
    api = TestBed.inject(ReviewsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('binds the public page to canonical application and coherent totals', async () => {
    const result = firstValueFrom(api.page(applicationId, null, false));
    http
      .expectOne(base)
      .flush({
        items: [review],
        next: null,
        mine: null,
        canModerate: false,
        summary: { total: 1, average: 4, distribution: [0, 0, 0, 1, 0] },
      });
    expect((await result).ok).toBe(true);
  });
  it.each([
    { ownerId: 'private-account' },
    { applicationId: id },
    { helpfulCount: 0 },
    { contentRevision: 3 },
    { hidden: 'false' },
    { content: { ...content, rating: 7 } },
  ])('refuses malformed or leaking review response %j', async (patch) => {
    const result = firstValueFrom(api.read(applicationId, id));
    http.expectOne(`${base}/${id}`).flush({ ...review, ...patch });
    expect((await result).ok).toBe(false);
  });
  it('requires an exact mutation receipt and retains uncertain malformed success for retry', async () => {
    const result = firstValueFrom(api.change(attempt));
    const request = http.expectOne(base + '/mine');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe(attempt.key);
    expect(request.request.body).toEqual({ expectedRevision: 0, content });
    request.flush({ id, revision: 5 });
    expect(await result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ uncertain: true }),
      })
    );
  });
  it('does not dispatch a write constructed in a different session', async () => {
    const request = api.change(attempt);
    token.next('bob');
    expect(await firstValueFrom(request)).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ status: 401, uncertain: false }),
      })
    );
    http.expectNone(base + '/mine');
  });
  it.each([400, 401, 403, 404, 409, 503])(
    'distinguishes definite failures and uncertainty at status %s',
    async (status) => {
      const result = firstValueFrom(api.change(attempt));
      http
        .expectOne(base + '/mine')
        .flush({}, { status, statusText: 'failure' });
      const response = await result;
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error).toBeInstanceOf(ReviewRequestError);
        expect((response.error as ReviewRequestError).uncertain).toBe(
          status >= 500
        );
      }
    }
  );
  it('rejects missing origins, credentials and origin paths without demo fallback', () => {
    for (const origin of [
      undefined,
      'https://user:secret@example.com',
      'https://example.com/path',
    ])
      expect(() => provideReviews(origin as string)).toThrow();
    expect(provideReviews('').length).toBe(3);
  });
});
