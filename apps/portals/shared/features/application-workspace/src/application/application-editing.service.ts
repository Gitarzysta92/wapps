import {
  DestroyRef,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  of,
  Subject,
  takeUntil,
  tap,
  type Observable,
} from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  parseApplicationImageMerge,
  type ApplicationImageMerge,
  type ApplicationImagePurpose,
} from '@domains/catalog/media';
import {
  parseApplicationDraftFields,
  type ApplicationDraft,
  type ApplicationDraftFields,
  type ApplicationDraftReceipt,
  type ApplicationEditingSource,
} from '@domains/catalog/record';
import {
  APPLICATION_EDITING,
  type ApplicationEditingCommand,
} from './application-ownership.port';
import {
  APPLICATION_DRAFTS,
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
  type ApplicationDraftChange,
} from './application-drafts.port';

type EditingAttempt =
  | { kind: 'private'; applicationId: string; command: ApplicationDraftChange }
  | { kind: 'canonical'; command: ApplicationEditingCommand };
export type ApplicationEditingReceipt = ApplicationDraftReceipt & {
  applicationId: string;
};
const empty = (): ApplicationDraftFields => ({
  name: '',
  slug: '',
  website: '',
  description: '',
});
@Injectable({ providedIn: 'root' })
export class ApplicationEditingService {
  private readonly port = inject(APPLICATION_EDITING);
  private readonly drafts = inject(APPLICATION_DRAFTS);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private attempt: { change: EditingAttempt; key: string } | null = null;
  private current: { applicationId: string; draftId: string | null } | null =
    null;
  readonly signedIn = signal(false);
  readonly sessionVersion = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly draft = signal<ApplicationDraft | null>(null);
  readonly source = signal<ApplicationEditingSource | null>(null);
  readonly fields = signal(empty());
  readonly imageChoices = signal<ApplicationImageMerge>({
    logo: 'draft',
    banner: 'draft',
  });
  readonly sourceChanged = computed(
    () =>
      !!this.draft()?.editing &&
      !!this.source() &&
      this.draft()?.editing?.sourcePublicationRevision !==
        this.source()?.sourcePublicationRevision
  );
  readonly grantChanged = computed(
    () =>
      !!this.draft()?.editing &&
      !!this.source() &&
      this.draft()?.editing?.claimId !== this.source()?.claimId
  );
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.sessionChanged.next();
        this.readChanged.next();
        this.attempt = null;
        this.current = null;
        this.signedIn.set(key !== null);
        this.draft.set(null);
        this.source.set(null);
        this.fields.set(empty());
        this.imageChoices.set({ logo: 'draft', banner: 'draft' });
        this.loading.set(false);
        this.saving.set(false);
        this.uncertain.set(false);
        this.error.set('');
        this.feedback.set('');
        this.sessionVersion.update((version) => version + 1);
      });
  }
  open(
    applicationId: string,
    draftId: string | null = null,
    keepFeedback = false
  ) {
    this.readChanged.next();
    this.current = { applicationId, draftId };
    this.draft.set(null);
    this.source.set(null);
    this.fields.set(empty());
    this.imageChoices.set({ logo: 'draft', banner: 'draft' });
    this.loading.set(false);
    this.error.set('');
    if (!keepFeedback) this.feedback.set('');
    if (!this.signedIn()) return;
    this.loading.set(true);
    const drafts = draftId
      ? this.drafts
          .read(draftId)
          .pipe(map((result) => (result.ok ? ok([result.value]) : result)))
      : this.drafts.list();
    forkJoin({ source: this.port.source(applicationId), drafts })
      .pipe(
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        catchError(() => of(null)),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (!result) {
          this.error.set('Editing workspace could not be loaded. Try again.');
          return;
        }
        if (!result.drafts.ok) {
          this.error.set(result.drafts.error.message);
          return;
        }
        const source = result.source.ok ? result.source.value : null;
        const draft = result.drafts.value.find(
          (item) =>
            item.editing?.applicationId === applicationId &&
            (draftId
              ? item.id === draftId
              : item.editing.claimId === source?.claimId)
        );
        if (draftId && !draft) {
          this.error.set(
            'This private draft does not edit the requested application.'
          );
          return;
        }
        if (source) this.source.set(source);
        else if (!result.source.ok) this.error.set(result.source.error.message);
        if (draft) {
          this.draft.set(draft);
          this.fields.set({
            name: draft.name,
            slug: draft.slug,
            website: draft.website,
            description: draft.description,
            ...(draft.classification
              ? { classification: draft.classification }
              : {}),
          });
        } else if (source) this.fields.set(source.fields);
      });
  }
  refreshSource() {
    if (
      !this.current ||
      this.loading() ||
      this.saving() ||
      this.uncertain() ||
      !this.signedIn()
    )
      return;
    this.readChanged.next();
    this.loading.set(true);
    this.error.set('');
    this.port
      .source(this.current.applicationId)
      .pipe(
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new Error(
                'Current canonical content is unavailable. Your private edits are retained.'
              )
            )
          )
        ),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) {
          this.source.set(result.value);
          this.imageChoices.set({ logo: 'draft', banner: 'draft' });
        } else {
          this.source.set(null);
          this.error.set(result.error.message);
        }
      });
  }
  reload() {
    if (this.current && !this.saving() && !this.uncertain())
      this.open(
        this.current.applicationId,
        this.draft()?.id ?? this.current.draftId
      );
  }
  acceptImageChange(receipt: ApplicationDraftReceipt) {
    const previous = this.draft();
    if (!previous || receipt.id !== previous.id) return;
    this.readChanged.next();
    this.loading.set(true);
    this.drafts
      .read(receipt.id)
      .pipe(
        takeUntil(this.sessionChanged),
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
          this.draft.set(result.value);
          this.error.set('');
        }
      });
  }
  setField<K extends keyof ApplicationDraftFields>(
    key: K,
    value: ApplicationDraftFields[K]
  ) {
    if (!this.saving() && !this.uncertain())
      this.fields.update((fields) => ({ ...fields, [key]: value }));
  }
  useCanonical(key: keyof ApplicationDraftFields) {
    const source = this.source();
    if (source) this.setField(key, source.fields[key]);
  }
  chooseImage(purpose: ApplicationImagePurpose, choice: 'draft' | 'canonical') {
    if (!this.saving() && !this.uncertain())
      this.imageChoices.update((choices) =>
        parseApplicationImageMerge({ ...choices, [purpose]: choice })
      );
  }
  save(merge = false) {
    try {
      const fields = parseApplicationDraftFields(this.fields());
      const draft = this.draft();
      if (draft && !draft.editing)
        throw new Error(
          'This private draft has no canonical application binding.'
        );
      if (!merge && draft && draft.editing)
        return this.execute({
          kind: 'private',
          applicationId: draft.editing.applicationId,
          command: {
            type: 'update',
            id: draft.id,
            expectedRevision: draft.revision,
            fields,
          },
        });
      const source = this.source();
      if (!source)
        throw new Error(
          'Load current canonical content before creating or merging an editing draft.'
        );
      if (merge && (!draft || this.grantChanged()))
        throw new Error(
          'A new ownership grant requires a new editing draft. Keep or remove the old private draft from My Apps.'
        );
      if (merge && (!draft?.images || !source.images))
        throw new Error(
          'Reload saved and canonical image information before merging.'
        );
      const editing = {
        applicationId: source.applicationId,
        claimId: source.claimId,
        sourcePublicationRevision: source.sourcePublicationRevision,
      };
      return this.execute({
        kind: 'canonical',
        command: {
          type: merge ? 'rebase' : 'open',
          id: draft?.id ?? null,
          expectedRevision: draft?.revision ?? null,
          editing,
          fields,
          ...(merge
            ? { imageChoices: parseApplicationImageMerge(this.imageChoices()) }
            : {}),
        },
      });
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error('Invalid editing request');
      this.error.set(failure.message);
      return of(err(failure));
    }
  }
  retry() {
    return this.attempt
      ? this.execute(this.attempt.change)
      : of(err(new Error('No pending editing change.')));
  }
  private execute(
    change: EditingAttempt
  ): Observable<Result<ApplicationEditingReceipt, Error>> {
    const sessionVersion = this.sessionVersion();
    return defer(() => {
      if (
        sessionVersion !== this.sessionVersion() ||
        !this.signedIn() ||
        this.session.currentKey() === null ||
        this.saving() ||
        this.loading()
      )
        return of(err(new Error('Sign in and wait for the current request.')));
      if (
        this.attempt &&
        JSON.stringify(this.attempt.change) !== JSON.stringify(change)
      ) {
        this.error.set(
          'Retry the unconfirmed request before making another change.'
        );
        return of(err(new Error(this.error())));
      }
      const attempt = (this.attempt ??= { change, key: crypto.randomUUID() });
      this.saving.set(true);
      this.error.set('');
      this.feedback.set('');
      return defer(() =>
        change.kind === 'private'
          ? this.drafts.change(change.command, attempt.key)
          : this.port.edit(change.command, attempt.key)
      ).pipe(
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
          if (result.ok) {
            this.attempt = null;
            this.uncertain.set(false);
            this.feedback.set(
              change.kind === 'canonical' && change.command.type === 'rebase'
                ? 'Merged draft saved. Pending review was cancelled; public content is unchanged.'
                : 'Private editing draft saved. Submit it for review to publish changes.'
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
        map((result) =>
          result.ok
            ? ok({
                ...result.value,
                applicationId:
                  change.kind === 'private'
                    ? change.applicationId
                    : change.command.editing.applicationId,
              })
            : result
        ),
        finalize(() => {
          this.saving.set(false);
          if (this.attempt) this.uncertain.set(true);
        })
      );
    });
  }
}
