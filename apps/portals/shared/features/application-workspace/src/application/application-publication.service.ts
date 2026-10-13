import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  forkJoin,
  of,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import { err, type Result } from '@sdk/kernel/standard';
import {
  parseApplicationPublicationInput,
  type ApplicationDraft,
  type ApplicationPublicationAction,
  type ApplicationPublicationStatus,
} from '@domains/catalog/record';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
} from './application-drafts.port';
import {
  APPLICATION_PUBLICATION,
  type ApplicationPublicationChange,
} from './application-publication.port';

export type ApplicationPublicationView = 'owner' | 'review' | 'queue';
@Injectable({ providedIn: 'root' })
export class ApplicationPublicationService {
  private readonly port = inject(APPLICATION_PUBLICATION);
  private readonly drafts = inject(APPLICATION_DRAFTS);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private current: {
    view: ApplicationPublicationView;
    id: string;
    page: number;
  } | null = null;
  private attempt: {
    command: ApplicationPublicationChange;
    key: string;
  } | null = null;
  readonly sessionVersion = signal(0);
  readonly signedIn = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly status = signal<ApplicationPublicationStatus | null>(null);
  readonly draft = signal<ApplicationDraft | null>(null);
  readonly queue = signal<ApplicationPublicationStatus[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.sessionChanged.next();
        this.readChanged.next();
        this.attempt = null;
        this.current = null;
        this.signedIn.set(key !== null);
        this.saving.set(false);
        this.uncertain.set(false);
        this.clear();
        this.feedback.set('');
        this.error.set('');
        this.sessionVersion.update((value) => value + 1);
      });
  }
  open(
    view: ApplicationPublicationView,
    id = '',
    page = 1,
    keepFeedback = false
  ) {
    this.readChanged.next();
    this.clear();
    this.error.set('');
    if (!keepFeedback) this.feedback.set('');
    this.current = { view, id, page };
    this.page.set(page);
    if (!this.signedIn()) return;
    this.loading.set(true);
    if (view === 'owner') {
      forkJoin({
        publication: this.port.status(id, false),
        draft: this.drafts.read(id),
      })
        .pipe(
          takeUntil(this.readChanged),
          takeUntil(this.sessionChanged),
          takeUntilDestroyed(this.destroy),
          catchError(() => {
            this.error.set(
              'Application publication could not be loaded. Try again.'
            );
            return of(null);
          }),
          finalize(() => this.loading.set(false))
        )
        .subscribe((result) => {
          if (!result) return;
          const { publication, draft } = result;
          if (!publication.ok) this.error.set(publication.error.message);
          else if (!draft.ok) this.error.set(draft.error.message);
          else if (publication.value.revision !== draft.value.revision)
            this.error.set(
              'The draft changed while loading. Reload before continuing.'
            );
          else {
            this.status.set(publication.value);
            this.draft.set(draft.value);
          }
        });
    } else if (view === 'review')
      this.read(this.port.status(id, true), (value) => this.status.set(value));
    else
      this.read(this.port.reviews(page), (value) => {
        this.queue.set(value.items);
        this.total.set(value.total);
      });
  }
  reload() {
    if (this.current && !this.saving() && !this.uncertain())
      this.open(this.current.view, this.current.id, this.current.page);
  }
  change(action: ApplicationPublicationAction, reason = '') {
    const status = this.status();
    if (!status) return;
    try {
      if (action === 'approve' && !status.latestSubmission?.images)
        throw new Error(
          'This submission has no recorded image snapshot. The author must resubmit before approval.'
        );
      const reviewing = action === 'approve' || action === 'reject';
      this.execute({
        id: status.id,
        action,
        input: parseApplicationPublicationInput(
          action,
          reviewing
            ? {
                expectedRevision: status.revision,
                submittedRevision: status.latestSubmission?.submittedRevision,
                reason,
              }
            : { expectedRevision: status.revision }
        ),
      });
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Invalid publication change'
      );
    }
  }
  retry() {
    if (this.attempt) this.execute(this.attempt.command);
  }
  private execute(command: ApplicationPublicationChange) {
    if (
      !this.signedIn() ||
      !this.session.currentKey() ||
      this.saving() ||
      this.loading()
    )
      return;
    if (
      this.attempt &&
      JSON.stringify(this.attempt.command) !== JSON.stringify(command)
    ) {
      this.error.set(
        'Retry the unconfirmed request before making another change.'
      );
      return;
    }
    const attempt = (this.attempt ??= { command, key: crypto.randomUUID() });
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    defer(() => this.port.change(command, attempt.key))
      .pipe(
        catchError(() =>
          of(
            err(
              new ApplicationDraftRequestError(
                true,
                'The change could not be confirmed. Retry the same request.'
              )
            )
          )
        ),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => {
          this.saving.set(false);
          if (this.attempt) this.uncertain.set(true);
        })
      )
      .subscribe((result) => {
        if (!result.ok) {
          const uncertain =
            result.error instanceof ApplicationDraftRequestError &&
            result.error.uncertain;
          if (!uncertain) this.attempt = null;
          this.uncertain.set(uncertain);
          this.error.set(result.error.message);
          return;
        }
        this.attempt = null;
        this.uncertain.set(false);
        if (this.current?.id === command.id) {
          this.feedback.set(
            command.action === 'submit'
              ? 'Submitted for review.'
              : command.action === 'approve'
              ? 'Approved. The catalog is updating.'
              : command.action === 'reject'
              ? 'Submission rejected. The author can see your reason.'
              : 'Withdrawn. This application is no longer public.'
          );
          this.open(
            this.current.view,
            this.current.id,
            this.current.page,
            true
          );
        }
      });
  }
  private read<T>(
    source: Observable<Result<T, Error>>,
    accept: (value: T) => void
  ) {
    source
      .pipe(
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new Error(
                'Application publication could not be loaded. Try again.'
              )
            )
          )
        ),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) accept(result.value);
        else this.error.set(result.error.message);
      });
  }
  private clear() {
    this.status.set(null);
    this.draft.set(null);
    this.queue.set([]);
    this.total.set(0);
    this.loading.set(false);
  }
}
