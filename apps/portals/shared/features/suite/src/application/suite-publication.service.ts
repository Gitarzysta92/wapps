import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  distinctUntilChanged,
  finalize,
  forkJoin,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import {
  parseSuitePublicationInput,
  type PrivateSuite,
  type PublicSuite,
  type SuitePublicationAction,
  type SuitePublicationStatus,
} from '@domains/publication/suite';
import type { CatalogApp } from '@domains/catalog/record';
import { permitsContent } from '@domains/publication/classification';
import { PublicContentPreferencesService } from '@portals/shared/features/preferences';
import {
  PRIVATE_SUITES,
  SUITE_SESSION,
  SuiteRequestError,
} from './private-suites.port';
import {
  SUITE_PUBLICATION,
  type SuitePublicationChange,
} from './suite-publication.port';

export type SuitePublicationView =
  | 'owner'
  | 'review'
  | 'catalog'
  | 'public'
  | 'queue';

@Injectable()
export class SuitePublicationService {
  private readonly port = inject(SUITE_PUBLICATION);
  private readonly privateSuites = inject(PRIVATE_SUITES);
  private readonly session = inject(SUITE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private readonly preferences = inject(PublicContentPreferencesService);
  private attempt: { command: SuitePublicationChange; key: string } | null =
    null;
  private current: {
    view: SuitePublicationView;
    id: string;
    q: string;
    page: number;
  } | null = null;
  readonly sessionVersion = signal(0);
  readonly signedIn = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly status = signal<SuitePublicationStatus | null>(null);
  readonly draft = signal<PrivateSuite | null>(null);
  readonly detail = signal<PublicSuite | null>(null);
  readonly items = signal<PublicSuite[]>([]);
  readonly queue = signal<SuitePublicationStatus[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly members = signal<CatalogApp[]>([]);
  readonly metadataLoading = signal(false);
  readonly metadataError = signal('');
  readonly preferencesLoading = signal(false);
  readonly preferencesError = signal(false);
  readonly hidden = signal(false);
  readonly hiddenCount = signal(0);
  readonly hiddenMemberIds = signal<string[]>([]);

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
    this.preferences.changes$.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.isPublic() && this.current) {
        const { view, id, q, page } = this.current;
        this.open(view, id, q, page);
      }
    });
  }

  open(
    view: SuitePublicationView,
    id = '',
    q = '',
    page = 1,
    keepFeedback = false
  ) {
    this.readChanged.next();
    this.clear();
    this.error.set('');
    if (!keepFeedback) this.feedback.set('');
    this.current = { view, id, q, page };
    this.page.set(page);
    if (['owner', 'review', 'queue'].includes(view) && !this.signedIn()) return;
    const choice = this.preferences.state();
    if (this.isPublic() && choice.status !== 'ready') {
      this.preferencesLoading.set(choice.status === 'loading');
      this.preferencesError.set(choice.status === 'unavailable');
      this.loading.set(choice.status === 'loading');
      return;
    }
    this.loading.set(true);
    if (view === 'owner') {
      forkJoin({
        publication: this.port.status(id, false),
        draft: this.privateSuites.read(id),
      })
        .pipe(
          takeUntil(this.readChanged),
          takeUntil(this.sessionChanged),
          takeUntilDestroyed(this.destroy),
          finalize(() => this.loading.set(false))
        )
        .subscribe(({ publication, draft }) => {
          if (!publication.ok) this.error.set(publication.error.message);
          else if (!draft.ok) this.error.set(draft.error.message);
          else if (publication.value.revision !== draft.value.revision)
            this.error.set('Suite changed while loading. Reload to continue.');
          else {
            this.status.set(publication.value);
            this.draft.set(draft.value);
            this.resolve(draft.value.applicationIds);
          }
        });
    } else if (view === 'review')
      this.read(this.port.status(id, true), (value) => {
        this.status.set(value);
        this.resolve(value.latestSubmission?.applicationIds ?? []);
      });
    else if (view === 'queue')
      this.read(this.port.reviews(page), (value) => {
        this.queue.set(value.items);
        this.total.set(value.total);
      });
    else if (view === 'public')
      this.read(this.port.find(id), (value) => {
        if (permitsContent(value, choice.showMatureContent)) {
          this.detail.set(value);
          this.resolve(value.applicationIds);
        } else this.hidden.set(true);
      });
    else
      this.read(this.port.browse({ q, page }), (value) => {
        const items = value.items.filter((item) =>
          permitsContent(item, choice.showMatureContent)
        );
        this.items.set(items);
        this.hiddenCount.set(value.items.length - items.length);
        this.total.set(value.total);
      });
  }

  reload() {
    if (this.isPublic() && this.preferencesError()) {
      this.preferences.reload();
      return;
    }
    if (this.current) {
      const { view, id, q, page } = this.current;
      this.open(view, id, q, page);
    }
  }
  member(id: string) {
    return this.members().find((item) => item.id === id);
  }
  change(action: SuitePublicationAction, reason = '') {
    const state = this.status();
    if (!state) return;
    try {
      const review = action === 'approve' || action === 'reject';
      this.execute({
        id: state.id,
        action,
        input: parseSuitePublicationInput(
          action,
          review
            ? {
                expectedRevision: state.revision,
                submittedRevision: state.latestSubmission?.submittedRevision,
                reason,
              }
            : { expectedRevision: state.revision }
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
  retryMembers() {
    this.resolve(
      this.detail()?.applicationIds ??
        (this.current?.view === 'review'
          ? this.status()?.latestSubmission?.applicationIds
          : this.draft()?.applicationIds) ??
        []
    );
  }

  private execute(command: SuitePublicationChange) {
    if (!this.signedIn() || !this.session.currentKey() || this.saving()) return;
    if (
      this.attempt &&
      JSON.stringify(this.attempt.command) !== JSON.stringify(command)
    ) {
      this.error.set(
        'Retry the unconfirmed request before making another change.'
      );
      return;
    }
    this.attempt ??= { command, key: crypto.randomUUID() };
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    this.port
      .change(command, this.attempt.key)
      .pipe(
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
            result.error instanceof SuiteRequestError && result.error.uncertain;
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
              ? 'Approved. Public content will appear when publication finishes.'
              : command.action === 'reject'
              ? 'Submission rejected. The owner can see your reason.'
              : 'Withdrawn. This suite is no longer public.'
          );
          const { view, id, q, page } = this.current;
          this.open(view, id, q, page, true);
        }
      });
  }

  private read<T>(
    request: Observable<Result<T, Error>>,
    accept: (value: T) => void
  ) {
    request
      .pipe(
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) accept(result.value);
        else this.error.set(result.error.message);
      });
  }
  private resolve(ids: string[]) {
    this.members.set([]);
    this.hiddenMemberIds.set([]);
    this.metadataError.set('');
    const publicView = this.isPublic();
    const choice = this.preferences.state();
    if (publicView && (choice.status !== 'ready' || !this.detail())) return;
    this.metadataLoading.set(true);
    this.privateSuites
      .resolve(ids)
      .pipe(
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.metadataLoading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) {
          const hidden = publicView
            ? result.value.filter(
                (item) => !permitsContent(item, choice.showMatureContent)
              )
            : [];
          this.hiddenMemberIds.set(hidden.map((item) => item.id));
          const excluded = new Set(this.hiddenMemberIds());
          this.members.set(
            result.value.filter((item) => !excluded.has(item.id))
          );
        } else
          this.metadataError.set(
            'Application details could not be loaded. Try again.'
          );
      });
  }
  private clear() {
    this.preferencesLoading.set(false);
    this.preferencesError.set(false);
    this.hidden.set(false);
    this.hiddenCount.set(0);
    this.hiddenMemberIds.set([]);
    this.status.set(null);
    this.draft.set(null);
    this.detail.set(null);
    this.items.set([]);
    this.queue.set([]);
    this.members.set([]);
    this.total.set(0);
    this.loading.set(false);
    this.metadataLoading.set(false);
    this.metadataError.set('');
  }

  private isPublic() {
    return this.current?.view === 'public' || this.current?.view === 'catalog';
  }
}
