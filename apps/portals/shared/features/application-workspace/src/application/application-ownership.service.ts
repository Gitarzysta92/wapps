import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  of,
  Subject,
  takeUntil,
  tap,
  type Observable,
} from 'rxjs';
import { err, type Result } from '@sdk/kernel/standard';
import {
  parseOwnershipClaimInput,
  parseOwnershipChangeInput,
  type OwnershipAction,
  type OwnershipClaim,
  type OwnershipReceipt,
} from '@domains/catalog/ownership';
import {
  APPLICATION_OWNERSHIP,
  type OwnershipApplication,
  type OwnershipCommand,
} from './application-ownership.port';
import {
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
} from './application-drafts.port';

export type OwnershipView =
  | 'list'
  | 'create'
  | 'owner'
  | 'queue'
  | 'grants'
  | 'review';
@Injectable({ providedIn: 'root' })
export class ApplicationOwnershipService {
  private readonly port = inject(APPLICATION_OWNERSHIP);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private attempt: { command: OwnershipCommand; key: string } | null = null;
  private current: {
    view: OwnershipView;
    id: string;
    slug: string;
    page: number;
  } | null = null;
  readonly sessionVersion = signal(0);
  readonly signedIn = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly application = signal<OwnershipApplication | null>(null);
  readonly claim = signal<OwnershipClaim | null>(null);
  readonly items = signal<OwnershipClaim[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.sessionChanged.next();
        this.readChanged.next();
        this.attempt = null;
        this.current = null;
        this.signedIn.set(key !== null);
        this.clear();
        this.saving.set(false);
        this.uncertain.set(false);
        this.error.set('');
        this.feedback.set('');
        this.sessionVersion.update((value) => value + 1);
      });
  }
  open(
    view: OwnershipView,
    id = '',
    slug = '',
    page = 1,
    keepFeedback = false
  ) {
    this.readChanged.next();
    this.clear();
    this.error.set('');
    if (!keepFeedback) this.feedback.set('');
    this.current = { view, id, slug, page };
    this.page.set(page);
    if (!this.signedIn()) return;
    this.loading.set(true);
    if (view === 'create')
      this.read(this.port.application(slug), (value) =>
        this.application.set(value)
      );
    else if (view === 'owner' || view === 'review')
      this.read(this.port.read(id, view === 'review'), (value) =>
        this.claim.set(value)
      );
    else
      this.read(
        this.port.list(
          view === 'queue' || view === 'grants',
          page,
          view === 'grants'
        ),
        (value) => {
          this.items.set(value.items);
          this.total.set(value.total);
        }
      );
  }
  reload() {
    const current = this.current;
    if (current && !this.saving() && !this.uncertain())
      this.open(current.view, current.id, current.slug, current.page);
  }
  create(evidenceUrl: string, notes: string) {
    try {
      const application = this.application();
      if (!application)
        throw new Error(
          'Load the public application before claiming ownership.'
        );
      return this.execute({
        action: 'create',
        input: parseOwnershipClaimInput({
          applicationId: application.id,
          evidenceUrl,
          notes,
        }),
      });
    } catch (error) {
      return this.invalid(error);
    }
  }
  change(action: Exclude<OwnershipAction, 'create'>, reason = '') {
    try {
      const claim = this.claim();
      if (!claim)
        throw new Error('Load the ownership claim before continuing.');
      return this.execute({
        id: claim.id,
        action,
        input: parseOwnershipChangeInput(action, {
          expectedRevision: claim.revision,
          ...(['reject', 'revoke', 'release', 'approve'].includes(action)
            ? { reason }
            : {}),
        }),
      });
    } catch (error) {
      return this.invalid(error);
    }
  }
  retry() {
    return this.attempt
      ? this.execute(this.attempt.command)
      : of(err(new Error('No pending ownership change.')));
  }
  private invalid(error: unknown) {
    const failure =
      error instanceof Error ? error : new Error('Invalid ownership request');
    this.error.set(failure.message);
    return of(err(failure));
  }
  private execute(
    command: OwnershipCommand
  ): Observable<Result<OwnershipReceipt, Error>> {
    const sessionVersion = this.sessionVersion();
    return defer(() => {
      if (
        sessionVersion !== this.sessionVersion() ||
        !this.signedIn() ||
        this.session.currentKey() === null ||
        this.loading() ||
        this.saving()
      )
        return of(err(new Error('Sign in and wait for the current request.')));
      if (
        this.attempt &&
        JSON.stringify(this.attempt.command) !== JSON.stringify(command)
      )
        return this.invalid(
          new Error(
            'Retry the unconfirmed request before making another change.'
          )
        );
      const attempt = (this.attempt ??= { command, key: crypto.randomUUID() });
      this.saving.set(true);
      this.error.set('');
      this.feedback.set('');
      return defer(() => this.port.change(command, attempt.key)).pipe(
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
        tap((result) => {
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
          this.feedback.set(
            command.action === 'create'
              ? 'Claim saved. Add the DNS TXT record to verify website control.'
              : command.action === 'verify'
              ? result.value.proofMatched
                ? 'Domain control verified. An independent reviewer must approve ownership.'
                : 'The matching TXT record was not found. Check the record and allow DNS propagation before trying again.'
              : command.action === 'approve'
              ? 'Ownership approved. Content changes still require independent review.'
              : command.action === 'reject'
              ? 'Ownership claim rejected. The claimant can see your reason.'
              : command.action === 'cancel'
              ? 'Ownership claim cancelled.'
              : 'Ownership grant revoked. Public content remains available; private drafts are retained.'
          );
        }),
        finalize(() => {
          this.saving.set(false);
          if (this.attempt) this.uncertain.set(true);
        })
      );
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
          of(err(new Error('Ownership could not be loaded. Try again.')))
        ),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) accept(result.value);
        else this.error.set(result.error.message);
      });
  }
  private clear() {
    this.application.set(null);
    this.claim.set(null);
    this.items.set([]);
    this.total.set(0);
    this.loading.set(false);
  }
}
