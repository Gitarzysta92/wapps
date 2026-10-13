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
  type Observable,
} from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  assertReleasePublicationTransition,
  assertReleaseSubmissionDate,
  assertReleaseVersion,
  parseReleaseFields,
  parseReleasePublicationInput,
  RELEASE_CHANGE_LIMIT,
  RELEASE_PAGE_SIZE,
  type ReleaseDraft,
  type ReleaseFields,
  type ReleasePublicationAction,
  type ReleasePublicationStatus,
  type ReleaseSource,
} from '@domains/catalog/versioning';
import { APPLICATION_WORKSPACE_SESSION } from './application-drafts.port';
import {
  RELEASE_WORKSPACE,
  ReleaseRequestError,
  type ReleaseChange,
  type ReleaseChangeReceipt,
} from './release-workspace.port';

export type ReleaseWorkspaceView = 'list' | 'new' | 'edit' | 'review' | 'queue';
export interface ReleaseWorkspaceLocation {
  view: ReleaseWorkspaceView;
  id?: string;
  applicationId?: string;
  releaseId?: string;
  page?: number;
}
const emptyFields = (): ReleaseFields => ({
  version: '',
  channel: 'stable',
  type: 'minor',
  releasedOn: new Date().toISOString().slice(0, 10),
  title: '',
  description: '',
  changes: [{ type: 'feature', description: '' }],
});
const fieldsOf = (value: ReleaseFields): ReleaseFields => ({
  version: value.version,
  channel: value.channel,
  type: value.type,
  releasedOn: value.releasedOn,
  title: value.title,
  description: value.description,
  changes: value.changes.map((change) => ({ ...change })),
});

@Injectable({ providedIn: 'root' })
export class ReleaseWorkspaceService {
  private readonly port = inject(RELEASE_WORKSPACE);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private readonly sourceChanged = new Subject<void>();
  private current: ReleaseWorkspaceLocation = { view: 'list' };
  private locationVersion = 0;
  private attempt: { command: ReleaseChange; key: string } | null = null;
  readonly sessionVersion = signal(0);
  readonly signedIn = signal(false);
  readonly loading = signal(false);
  readonly sourceLoading = signal(false);
  readonly saving = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal('');
  readonly sourceError = signal('');
  readonly feedback = signal('');
  readonly items = signal<ReleaseDraft[]>([]);
  readonly draft = signal<ReleaseDraft | null>(null);
  readonly status = signal<ReleasePublicationStatus | null>(null);
  readonly source = signal<ReleaseSource | null>(null);
  readonly fields = signal<ReleaseFields>(emptyFields());
  readonly queue = signal<ReleasePublicationStatus[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = RELEASE_PAGE_SIZE;
  readonly result = signal<ReleaseChangeReceipt | null>(null);
  readonly createdHere = signal(false);
  readonly locked = computed(
    () =>
      this.loading() ||
      this.sourceLoading() ||
      this.saving() ||
      this.uncertain()
  );
  readonly dirty = computed(() => {
    const draft = this.draft();
    return (
      !!draft &&
      JSON.stringify(this.fields()) !== JSON.stringify(fieldsOf(draft))
    );
  });
  readonly mayRebase = computed(() => {
    const draft = this.draft(),
      source = this.source();
    return (
      !!draft &&
      !!source &&
      source.claimId === draft.target.claimId &&
      source.applicationId === draft.target.applicationId
    );
  });

  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.attempt = null;
        this.sessionChanged.next();
        this.readChanged.next();
        this.sourceChanged.next();
        this.locationVersion++;
        this.clear();
        this.signedIn.set(key !== null);
        this.saving.set(false);
        this.uncertain.set(false);
        this.feedback.set('');
        this.sessionVersion.update((version) => version + 1);
      });
  }

  open(location: ReleaseWorkspaceLocation, keepFeedback = false) {
    this.readChanged.next();
    this.sourceChanged.next();
    this.locationVersion++;
    this.current = { ...location };
    this.clear();
    if (!keepFeedback) this.feedback.set('');
    if (!this.signedIn()) return;
    const page = location.page ?? 1;
    this.page.set(page);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      this.error.set('Choose a valid page.');
      return;
    }
    this.loading.set(true);
    if (location.view === 'list')
      this.read(this.port.list(), (value) => this.items.set(value));
    else if (location.view === 'queue')
      this.read(this.port.reviews(page), (value) => {
        this.queue.set(value.items);
        this.total.set(value.total);
      });
    else if (location.view === 'review')
      this.read(this.port.status(location.id ?? '', true), (value) =>
        this.status.set(value)
      );
    else if (location.view === 'new') {
      this.loading.set(false);
      if (location.applicationId) this.loadSource();
    } else {
      this.read(
        forkJoin({
          draft: this.port.read(location.id ?? ''),
          status: this.port.status(location.id ?? '', false),
        }).pipe(
          map((value) => {
            // Both reads must describe the same private revision before any command is prepared.
            if (!value.draft.ok) return err(value.draft.error);
            if (!value.status.ok) return err(value.status.error);
            if (value.draft.value.revision !== value.status.value.revision)
              return err(
                new Error(
                  'The draft changed while loading. Reload before continuing.'
                )
              );
            return ok({ draft: value.draft.value, status: value.status.value });
          })
        ),
        (value) => {
          this.draft.set(value.draft);
          this.status.set(value.status);
          this.fields.set(fieldsOf(value.draft));
        }
      );
    }
  }

  reload() {
    if (!this.locked()) this.open(this.current);
  }
  refreshSource() {
    if (this.locked()) return;
    this.loadSource();
  }
  private loadSource() {
    const draft = this.draft();
    const applicationId =
      draft?.target.applicationId ?? this.current.applicationId;
    if (!applicationId) return;
    const releaseId = draft
      ? this.status()?.publicationRevision
        ? draft.target.releaseId
        : null
      : this.current.releaseId ?? null;
    this.sourceChanged.next();
    this.source.set(null);
    this.sourceError.set('');
    this.sourceLoading.set(true);
    defer(() => this.port.source(applicationId, releaseId))
      .pipe(
        catchError(() =>
          of(
            err(
              new Error(
                'The current ownership and release source could not be loaded.'
              )
            )
          )
        ),
        takeUntil(this.sourceChanged),
        takeUntil(this.readChanged),
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.sourceLoading.set(false))
      )
      .subscribe((result) => {
        if (!result.ok) this.sourceError.set(result.error.message);
        else {
          this.source.set(result.value);
          if (draft && result.value.claimId !== draft.target.claimId)
            this.sourceError.set(
              'Ownership changed. Keep or delete this private draft; start a new draft under your current grant to publish.'
            );
        }
      });
  }

  setField<K extends keyof ReleaseFields>(key: K, value: ReleaseFields[K]) {
    if (this.locked()) return;
    this.fields.update((fields) => ({ ...fields, [key]: value }));
    this.feedback.set('');
  }
  setChange(index: number, key: 'type' | 'description', value: string) {
    const changes = this.fields().changes.map((change, at) =>
      at === index ? { ...change, [key]: value } : { ...change }
    );
    this.setField('changes', changes);
  }
  addChange() {
    if (this.fields().changes.length < RELEASE_CHANGE_LIMIT)
      this.setField('changes', [
        ...this.fields().changes,
        { type: 'feature', description: '' },
      ]);
  }
  removeChange(index: number) {
    if (this.fields().changes.length > 1)
      this.setField(
        'changes',
        this.fields().changes.filter((_, at) => index !== at)
      );
  }
  useCanonical(key: keyof ReleaseFields) {
    const release = this.source()?.release;
    if (release) this.setField(key, fieldsOf(release)[key]);
  }

  save() {
    this.prepare(() => {
      const fields = parseReleaseFields(this.fields()),
        draft = this.draft();
      assertReleaseVersion(fields, this.status()?.publicVersion ?? null);
      if (draft)
        return {
          kind: 'draft',
          type: 'update',
          id: draft.id,
          input: { expectedRevision: draft.revision, fields },
        };
      const source = this.source();
      if (this.current.view !== 'new' || !source || source.release)
        throw new Error(
          'Choose an application with verified ownership before creating notes.'
        );
      return {
        kind: 'draft',
        type: 'create',
        input: {
          applicationId: source.applicationId,
          claimId: source.claimId,
          fields,
        },
      };
    });
  }
  openCanonical() {
    this.prepare(() => {
      const source = this.source();
      if (this.current.view !== 'new' || !source?.release)
        throw new Error('Load the current published notes first.');
      return {
        kind: 'draft',
        type: 'open',
        input: {
          applicationId: source.applicationId,
          claimId: source.claimId,
          releaseId: source.release.id,
          expectedPublicationRevision: source.release.revision,
        },
      };
    });
  }
  rebase() {
    this.prepare(() => {
      const draft = this.draft(),
        source = this.source();
      if (!draft || !source || !this.mayRebase())
        throw new Error(
          'Refresh the current release and ownership before merging.'
        );
      const fields = parseReleaseFields(this.fields());
      assertReleaseVersion(fields, source.release?.version ?? null);
      return {
        kind: 'draft',
        type: 'rebase',
        id: draft.id,
        input: {
          expectedRevision: draft.revision,
          expectedPublicationRevision: source.release?.revision ?? null,
          fields,
        },
      };
    });
  }
  remove() {
    const draft = this.draft();
    if (draft)
      this.execute({
        kind: 'draft',
        type: 'delete',
        id: draft.id,
        input: { expectedRevision: draft.revision },
      });
  }
  publish(action: ReleasePublicationAction, reason = '') {
    this.prepare(() => {
      const status = this.status(),
        reviewing = action === 'approve' || action === 'reject';
      if (!status) throw new Error('Load the release before continuing.');
      if (
        (reviewing && this.current.view !== 'review') ||
        (!reviewing && this.current.view !== 'edit')
      )
        throw new Error('Open the appropriate release workspace first.');
      if (action === 'submit') {
        if (this.dirty())
          throw new Error('Save your changes before submitting for review.');
        const draft = this.draft();
        if (!draft) throw new Error('Load the saved draft before submitting.');
        assertReleaseSubmissionDate(draft, Date.now());
      }
      const input = parseReleasePublicationInput(action, {
        expectedRevision: status.revision,
        expectedPublicationRevision: status.publicationRevision,
        ...(reviewing
          ? {
              submittedRevision: status.latestSubmission?.submittedRevision,
              reason,
            }
          : {}),
      });
      assertReleasePublicationTransition(action, status, input);
      return { kind: 'publication', id: status.id, action, input };
    });
  }
  retry() {
    if (this.attempt) this.execute(this.attempt.command);
  }
  private prepare(command: () => ReleaseChange) {
    if (this.locked()) return;
    try {
      this.execute(command());
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Invalid release change'
      );
    }
  }
  private execute(command: ReleaseChange) {
    if (
      !this.signedIn() ||
      !this.session.currentKey() ||
      this.loading() ||
      this.sourceLoading() ||
      this.saving()
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
    const attempt = (this.attempt ??= {
      command,
      key: crypto.randomUUID(),
    });
    const locationVersion = this.locationVersion;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    // Feature-owned subscription survives page destruction; session changes fence all continuations.
    defer(() => this.port.change(attempt.command, attempt.key))
      .pipe(
        catchError(() =>
          of(
            err(
              new ReleaseRequestError(
                'The change could not be confirmed. Retry the same request.',
                true
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
            result.error instanceof ReleaseRequestError &&
            result.error.uncertain;
          if (!uncertain) this.attempt = null;
          this.uncertain.set(uncertain);
          this.error.set(result.error.message);
          return;
        }
        this.attempt = null;
        this.uncertain.set(false);
        if (
          locationVersion === this.locationVersion &&
          command.kind === 'draft' &&
          (command.type === 'create' || command.type === 'open') &&
          this.current.view === 'new' &&
          this.current.applicationId === command.input.applicationId
        )
          this.createdHere.set(true);
        this.feedback.set(
          command.kind === 'publication'
            ? {
                submit: 'Submitted for independent review.',
                approve: 'Approved. The public devlog is updating.',
                reject: 'Submission rejected. The author can see your reason.',
                withdraw:
                  'Withdrawn. These release notes are no longer public.',
              }[command.action]
            : command.type === 'delete'
            ? 'Private draft deleted. Previously approved public notes are retained.'
            : 'Release draft saved to your account.'
        );
        if (this.current.view === 'list' || this.current.view === 'queue') {
          this.open(this.current, true);
        } else if (
          locationVersion === this.locationVersion &&
          'id' in command &&
          this.current.id === command.id
        ) {
          if ('deleted' in result.value && result.value.deleted) this.clear();
          else this.open(this.current, true);
        }
        this.result.set(result.value);
      });
  }
  private read<T>(
    source: Observable<Result<T, Error>>,
    accept: (value: T) => void
  ) {
    source
      .pipe(
        catchError(() =>
          of(err(new Error('Release notes could not be loaded. Try again.')))
        ),
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
  private clear() {
    this.loading.set(false);
    this.sourceLoading.set(false);
    this.items.set([]);
    this.draft.set(null);
    this.status.set(null);
    this.source.set(null);
    this.fields.set(emptyFields());
    this.queue.set([]);
    this.total.set(0);
    this.error.set('');
    this.sourceError.set('');
    this.result.set(null);
    this.createdHere.set(false);
  }
}
