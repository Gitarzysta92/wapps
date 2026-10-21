import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { ReviewReceipt } from '@sdk/features/review/core';
import type { MemberReview, ReviewPage } from '@domains/community';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { ReviewsService } from './application/reviews.service';
import {
  REVIEWS,
  ReviewRequestError,
  type ReviewsPort,
} from './application/reviews.port';

const app = '10000000-0000-4000-8000-000000000001',
  id = '10000000-0000-4000-8000-000000000002';
const content = { displayName: 'Member', rating: 4, text: 'Useful.' };
const review: MemberReview = {
  id,
  applicationId: app,
  content,
  revision: 1,
  contentRevision: 1,
  createdAt: 1,
  updatedAt: 1,
  withdrawn: false,
  hidden: false,
  moderationReason: null,
  helpfulCount: 0,
  helpful: false,
  reported: false,
  mine: true,
  canModerate: false,
  openReports: null,
};
const page: ReviewPage = {
  items: [review],
  next: null,
  mine: review,
  canModerate: false,
  summary: { total: 1, average: 4, distribution: [0, 0, 0, 1, 0] },
};

describe('Review state and exact retry', () => {
  let port: jest.Mocked<ReviewsPort>,
    session: BehaviorSubject<string | null>,
    service: ReviewsService;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    port = {
      summary: jest.fn().mockReturnValue(of(ok(page.summary))),
      page: jest.fn().mockReturnValue(of(ok(page))),
      read: jest.fn().mockReturnValue(of(ok(review))),
      reports: jest.fn().mockReturnValue(of(ok({ items: [], next: null }))),
      change: jest.fn().mockReturnValue(of(ok({ id, revision: 2 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        ReviewsService,
        { provide: REVIEWS, useValue: port },
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: session, getToken: () => session.value },
        },
      ],
    });
    service = TestBed.inject(ReviewsService);
  });
  it('preserves an immutable request across component destruction and clears it on account change', () => {
    port.change.mockReturnValue(
      of(err(new ReviewRequestError('Uncertain', 503, true)))
    );
    const injector = createEnvironmentInjector(
      [ReviewsService],
      TestBed.inject(EnvironmentInjector)
    );
    const routed = injector.get(ReviewsService);
    routed.open(app, null);
    const draft = { ...content };
    routed.publish(draft);
    draft.text = 'Changed after dispatch';
    const first = port.change.mock.calls[0][0];
    injector.destroy();
    service.open(app, null);
    service.retry();
    expect(port.change.mock.calls[1][0]).toEqual(first);
    expect(first.change).toMatchObject({ content, expectedRevision: 1 });
    session.next('bob');
    expect(service.pending()).toBeNull();
    service.retry();
    expect(port.change).toHaveBeenCalledTimes(2);
  });
  it('does not retry or create another write on a different application while a request is uncertain', () => {
    port.change.mockReturnValue(
      of(err(new ReviewRequestError('Uncertain', 503, true)))
    );
    service.open(app, null);
    service.publish(content);
    service.open(id, null);
    service.retry();
    service.publish(content);
    expect(port.change).toHaveBeenCalledTimes(1);
  });
  it('does not let delayed data from another session repaint the private author slot', () => {
    const delayed = new Subject<Result<ReviewPage, Error>>();
    port.page.mockReturnValueOnce(delayed);
    service.open(app, null);
    port.page.mockReturnValue(of(ok({ ...page, items: [], mine: null })));
    session.next('bob');
    delayed.next(ok(page));
    expect(service.mine()).toBeNull();
    expect(service.items()).toEqual([]);
  });
  it('cancels stale detail reads when the selected review changes', () => {
    const delayed = new Subject<Result<MemberReview, Error>>();
    port.read
      .mockReturnValueOnce(delayed)
      .mockReturnValueOnce(of(err(new Error('Missing review'))));
    service.open(app, id);
    service.open(app, app);
    delayed.next(ok(review));
    expect(service.items()).toEqual([]);
    expect(service.error()).toBe('Missing review');
  });
  it('retains confirmed acceptance when reloading the public result fails', () => {
    service.open(app, null);
    port.page.mockReturnValue(of(err(new Error('Read unavailable'))));
    service.publish(content);
    expect(service.published()).toBe(1);
    expect(service.feedback()).toBe('Review change saved.');
    expect(service.error()).toBe('Read unavailable');
    expect(service.summary()).toBeNull();
    expect(service.pending()).toBeNull();
  });
  it('clears definite conflicts for explicit reload without counting a publication', () => {
    service.open(app, null);
    port.change.mockReturnValue(of(err(new ReviewRequestError('Reload', 409))));
    service.publish(content);
    expect(service.pending()).toBeNull();
    expect(service.published()).toBe(0);
    expect(service.error()).toBe('Reload');
  });
  it('keeps a pending receipt when a route changes while a write is in flight', () => {
    const delayed = new Subject<Result<ReviewReceipt, Error>>();
    port.change.mockReturnValue(delayed);
    service.open(app, null);
    service.publish(content);
    service.open(id, null);
    delayed.next(ok({ id, revision: 2 }));
    expect(service.pending()).not.toBeNull();
    expect(service.published()).toBe(0);
    expect(service.saving()).toBe(false);
  });
  it('discards moderation and report content on sign out', () => {
    port.page.mockReturnValue(of(ok({ ...page, canModerate: true })));
    service.open(app, null);
    service.toggleModeration();
    service.loadReports(id);
    session.next(null);
    expect(service.moderation()).toBe(false);
    expect(service.reports()).toBeNull();
    expect(service.reportsId()).toBeNull();
  });
});
