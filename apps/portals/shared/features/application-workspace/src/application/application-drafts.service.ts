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
  parseApplicationDraftFields,
  type ApplicationDraft,
  type ApplicationDraftFields,
  type ApplicationDraftReceipt,
} from '@domains/catalog/record';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
  type ApplicationDraftChange,
} from './application-drafts.port';

const emptyFields = (): ApplicationDraftFields => ({
  name: '',
  slug: '',
  website: '',
  description: '',
});

@Injectable({ providedIn: 'root' })
export class ApplicationDraftsService {
  private readonly port = inject(APPLICATION_DRAFTS);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private requestedId: string | null = null;
  private mode: 'list' | 'edit' = 'list';
  private attempt: { command: ApplicationDraftChange; key: string } | null =
    null;
  readonly signedIn = signal(false);
  readonly sessionVersion = signal(0);
  readonly items = signal<ApplicationDraft[]>([]);
  readonly detail = signal<ApplicationDraft | null>(null);
  readonly fields = signal(emptyFields());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.changed.next();
        this.attempt = null;
        this.signedIn.set(key !== null);
        this.items.set([]);
        this.detail.set(null);
        this.fields.set(emptyFields());
        this.loading.set(false);
        this.saving.set(false);
        this.uncertain.set(false);
        this.error.set('');
        this.feedback.set('');
        this.sessionVersion.update((version) => version + 1);
      });
  }
  open(mode: 'list' | 'edit', id: string | null = null) {
    this.readChanged.next();
    this.mode = mode;
    this.requestedId = id;
    this.items.set([]);
    this.detail.set(null);
    this.fields.set(emptyFields());
    this.loading.set(false);
    this.error.set('');
    if (!this.signedIn() || (mode === 'edit' && !id)) return;
    this.loading.set(true);
    if (mode === 'list') {
      this.port
        .list()
        .pipe(
          takeUntil(this.changed),
          takeUntil(this.readChanged),
          takeUntilDestroyed(this.destroy),
          catchError(() =>
            of(
              err(
                new Error('Application drafts could not be loaded. Try again.')
              )
            )
          ),
          finalize(() => this.loading.set(false))
        )
        .subscribe((result) => {
          if (result.ok) this.items.set(result.value);
          else this.error.set(result.error.message);
        });
    } else if (id) {
      this.port
        .read(id)
        .pipe(
          takeUntil(this.changed),
          takeUntil(this.readChanged),
          takeUntilDestroyed(this.destroy),
          catchError(() =>
            of(
              err(
                new Error('Application draft could not be loaded. Try again.')
              )
            )
          ),
          finalize(() => this.loading.set(false))
        )
        .subscribe((result) => {
          if (result.ok) {
            this.detail.set(result.value);
            this.fields.set({
              name: result.value.name,
              slug: result.value.slug,
              website: result.value.website,
              description: result.value.description,
              ...(result.value.classification
                ? { classification: result.value.classification }
                : {}),
            });
          } else this.error.set(result.error.message);
        });
    }
  }
  reload() {
    if (!this.saving() && !this.uncertain())
      this.open(this.mode, this.requestedId);
  }
  acceptImageChange(receipt: ApplicationDraftReceipt) {
    const previous = this.detail();
    if (!previous || receipt.id !== previous.id) return;
    this.readChanged.next();
    this.loading.set(true);
    this.port
      .read(receipt.id)
      .pipe(
        takeUntil(this.changed),
        takeUntil(this.readChanged),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new Error(
                'The image change was saved, but the draft could not be refreshed. Reload before saving text.'
              )
            )
          )
        ),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (!result.ok) this.error.set(result.error.message);
        else if (
          ![previous.revision, previous.revision + 1].includes(
            receipt.revision
          ) ||
          result.value.revision !== receipt.revision ||
          (
            [
              'name',
              'slug',
              'website',
              'description',
              'classification',
            ] as const
          ).some((key) => result.value[key] !== previous[key])
        )
          this.error.set(
            'The saved draft changed during the image request. Your unsaved text is retained. Reload and compare before saving.'
          );
        else {
          this.detail.set(result.value);
          this.error.set('');
        }
      });
  }
  setField<K extends keyof ApplicationDraftFields>(
    key: K,
    value: ApplicationDraftFields[K]
  ) {
    if (this.saving() || this.uncertain()) return;
    this.fields.update((fields) => ({ ...fields, [key]: value }));
    this.feedback.set('');
  }
  save() {
    try {
      if (this.mode !== 'edit' || (this.requestedId && !this.detail()))
        throw new Error('Load the draft before saving.');
      const fields = parseApplicationDraftFields(this.fields());
      const current = this.detail();
      return this.change({
        type: current ? 'update' : 'create',
        id: current?.id ?? null,
        expectedRevision: current?.revision ?? null,
        fields,
      });
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error('Invalid application draft');
      this.error.set(failure.message);
      return of(err(failure));
    }
  }
  remove(draft: ApplicationDraft) {
    return this.change({
      type: 'delete',
      id: draft.id,
      expectedRevision: draft.revision,
      fields: null,
    });
  }
  retry() {
    return this.attempt
      ? this.change(this.attempt.command)
      : of(err(new Error('No pending draft change.')));
  }
  private change(
    command: ApplicationDraftChange
  ): Observable<Result<ApplicationDraftReceipt, Error>> {
    const sessionVersion = this.sessionVersion();
    return defer(() => {
      if (sessionVersion !== this.sessionVersion())
        return of(
          err(new Error('The account changed. Reopen the draft before saving.'))
        );
      if (
        !this.signedIn() ||
        this.session.currentKey() === null ||
        this.saving() ||
        this.loading()
      )
        return of(err(new Error('Sign in and wait for the current request.')));
      if (
        this.attempt &&
        JSON.stringify(this.attempt.command) !== JSON.stringify(command)
      ) {
        this.error.set(
          'Retry the unconfirmed request before making another change.'
        );
        return of(err(new Error(this.error())));
      }
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
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        tap((result) => {
          if (result.ok) {
            this.attempt = null;
            this.uncertain.set(false);
            this.feedback.set(
              result.value.deleted
                ? 'Application draft deleted.'
                : 'Application draft saved to your account.'
            );
          } else {
            const uncertain =
              result.error instanceof ApplicationDraftRequestError &&
              result.error.uncertain;
            if (!uncertain) this.attempt = null;
            this.uncertain.set(uncertain);
            this.error.set(result.error.message);
          }
        }),
        finalize(() => {
          this.saving.set(false);
          if (this.attempt) this.uncertain.set(true);
        })
      );
    });
  }
}
