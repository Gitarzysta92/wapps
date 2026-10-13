import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  distinctUntilChanged,
  of,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import { err, type Result } from '@sdk/kernel/standard';
import {
  reviewChange,
  type MemberReview,
  type ReviewChange,
  type ReviewContent,
  type ReviewPage,
  type ReviewReportPage,
  type ReviewSummary,
} from '@sdk/features/review/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { REVIEWS, ReviewRequestError } from './reviews.port';
import { ReviewRecoveryService } from './review-recovery.service';

@Injectable()
export class ReviewsService {
  private readonly port = inject(REVIEWS);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly recovery = inject(ReviewRecoveryService);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private readonly reads = new Subject<void>();
  private readonly reportReads = new Subject<void>();
  private applicationId: string | null = null;
  private reviewId: string | null = null;
  private cursor: string | null = null;
  summaryFor(applicationId: string) {
    return this.port.summary(applicationId);
  }
  readonly items = signal<MemberReview[]>([]);
  readonly mine = signal<MemberReview | null>(null);
  readonly summary = signal<ReviewSummary | null>(null);
  readonly next = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly signedIn = signal(false);
  readonly canModerate = signal(false);
  readonly moderation = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly reports = signal<ReviewReportPage | null>(null);
  readonly reportsId = signal<string | null>(null);
  readonly reportsError = signal('');
  readonly reportsLoading = signal(false);
  readonly sessionVersion = signal(0);
  readonly contextVersion = signal(0);
  readonly published = signal(0);
  readonly pending = this.recovery.attempt;

  constructor() {
    this.session.token$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((token) => {
        this.changed.next();
        this.sessionVersion.update((value) => value + 1);
        this.signedIn.set(token !== null);
        this.moderation.set(false);
        this.canModerate.set(false);
        this.saving.set(false);
        this.feedback.set('');
        this.reload(true);
      });
  }

  open(applicationId: string | null, reviewId: string | null) {
    if (applicationId === this.applicationId && reviewId === this.reviewId)
      return;
    this.changed.next();
    this.saving.set(false);
    this.applicationId = applicationId;
    this.reviewId = reviewId;
    this.contextVersion.update((value) => value + 1);
    this.moderation.set(false);
    this.feedback.set('');
    this.reload(true);
  }

  reload(first = false) {
    this.reads.next();
    this.closeReports();
    this.items.set([]);
    this.canModerate.set(false);
    this.mine.set(null);
    this.summary.set(null);
    this.next.set(null);
    this.error.set('');
    this.loading.set(false);
    if (first) this.cursor = null;
    if (!this.applicationId) return;
    this.loading.set(true);
    const request: Observable<Result<MemberReview | ReviewPage, Error>> = this
      .reviewId
      ? this.port.read(this.applicationId, this.reviewId)
      : this.port.page(this.applicationId, this.cursor, this.moderation());
    request
      .pipe(
        takeUntil(this.reads),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(err(new Error('Reviews could not be loaded. Try again.')))
        )
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (!result.ok) {
          this.error.set(result.error.message);
          return;
        }
        const value = result.value;
        if ('items' in value) {
          this.items.set(value.items);
          this.mine.set(value.mine);
          this.summary.set(value.summary);
          this.next.set(value.next);
          this.canModerate.set(value.canModerate);
        } else {
          this.items.set([value]);
          this.mine.set(value.mine ? value : null);
          this.canModerate.set(value.canModerate);
        }
      });
  }
  older() {
    if (this.next() && !this.loading() && !this.saving()) {
      this.cursor = this.next();
      this.reload();
    }
  }
  toggleModeration() {
    if (this.canModerate() && !this.saving() && !this.reviewId) {
      this.moderation.update((value) => !value);
      this.reload(true);
    }
  }
  publish(content: ReviewContent) {
    this.change(null, {
      type: 'publish',
      content,
      expectedRevision: this.mine()?.revision ?? 0,
    });
  }
  withdraw(item: MemberReview) {
    this.change(item.id, { type: 'withdraw', expectedRevision: item.revision });
  }
  helpful(item: MemberReview) {
    this.change(item.id, {
      type: 'helpful',
      helpful: !item.helpful,
      expectedRevision: item.revision,
    });
  }
  report(item: MemberReview, reason: string) {
    this.change(item.id, {
      type: 'report',
      reason,
      expectedRevision: item.revision,
    });
  }
  moderate(item: MemberReview, hidden: boolean, reason: string) {
    this.change(item.id, {
      type: 'moderate',
      hidden,
      reason,
      expectedRevision: item.revision,
    });
  }

  private change(id: string | null, change: ReviewChange) {
    if (
      !this.applicationId ||
      !this.signedIn() ||
      this.saving() ||
      this.pending() ||
      this.loading() ||
      this.error()
    )
      return;
    try {
      const { type, ...body } = change;
      const validated = reviewChange(type, body);
      this.pending.set({
        applicationId: this.applicationId,
        id,
        change: validated,
        key: crypto.randomUUID(),
      });
      this.retry();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Check your review.'
      );
    }
  }
  retry() {
    const attempt = this.pending();
    if (
      !attempt ||
      attempt.applicationId !== this.applicationId ||
      !this.signedIn() ||
      this.saving()
    )
      return;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    this.port
      .change(attempt)
      .pipe(
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new ReviewRequestError(
                'The change could not be confirmed. Retry the same request.',
                0,
                true
              )
            )
          )
        )
      )
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.pending.set(null);
          this.feedback.set('Review change saved.');
          if (attempt.change.type === 'publish')
            this.published.update((value) => value + 1);
          this.reload(true);
        } else {
          this.error.set(result.error.message);
          if (
            !(result.error instanceof ReviewRequestError) ||
            !result.error.uncertain
          )
            this.pending.set(null);
        }
      });
  }
  dismissRetry() {
    if (this.saving()) return;
    this.pending.set(null);
    this.feedback.set(
      'Retry dismissed. Reloaded state shows whether the change was saved.'
    );
    this.reload(true);
  }
  loadReports(id: string, cursor: string | null = null) {
    if (!this.applicationId || !this.canModerate()) return;
    this.reportReads.next();
    this.reportsId.set(id);
    this.reports.set(null);
    this.reportsError.set('');
    this.reportsLoading.set(true);
    this.port
      .reports(this.applicationId, id, cursor)
      .pipe(
        takeUntil(this.reportReads),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        catchError(() => of(err(new Error('Reports could not be loaded.'))))
      )
      .subscribe((result) => {
        this.reportsLoading.set(false);
        if (result.ok) this.reports.set(result.value);
        else this.reportsError.set(result.error.message);
      });
  }
  closeReports() {
    this.reportReads.next();
    this.reportsId.set(null);
    this.reports.set(null);
    this.reportsError.set('');
    this.reportsLoading.set(false);
  }
}
