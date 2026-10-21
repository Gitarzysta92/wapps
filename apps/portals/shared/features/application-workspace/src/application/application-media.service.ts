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
  distinctUntilChanged,
  firstValueFrom,
  of,
  Subject,
  takeUntil,
  type Observable,
} from 'rxjs';
import { err, type Result } from '@sdk/kernel/standard';
import type {
  ApplicationDraft,
  ApplicationDraftReceipt,
} from '@domains/catalog/record';
import {
  parseApplicationImageChange,
  type ApplicationImagePurpose,
  type ApplicationImageSource,
  type ApplicationImageUpload,
} from '@domains/catalog/media';
import {
  APPLICATION_WORKSPACE_SESSION,
  ApplicationDraftRequestError,
} from './application-drafts.port';
import {
  APPLICATION_MEDIA,
  APPLICATION_MEDIA_RECOVERY,
  type ApplicationMediaAttempt,
  type ApplicationMediaIntent,
} from './application-media.port';

@Injectable({ providedIn: 'root' })
export class ApplicationMediaService {
  private readonly port = inject(APPLICATION_MEDIA);
  private readonly recovery = inject(APPLICATION_MEDIA_RECOVERY);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly sessionChanged = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private version = 0;
  private currentId: string | null = null;
  private scope: string | null = null;
  private file: File | null = null;
  private stopped = false;
  readonly changed = new Subject<ApplicationDraftReceipt>();
  readonly items = signal<ApplicationImageUpload[]>([]);
  readonly pending = signal<ApplicationMediaAttempt | null>(null);
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly recovering = signal(false);
  readonly recoveryReady = signal(false);
  readonly error = signal('');
  readonly listError = signal('');
  readonly feedback = signal('');
  readonly signedIn = signal(false);
  readonly sessionVersion = signal(0);
  readonly blocked = computed(
    () =>
      this.saving() ||
      this.recovering() ||
      !this.recoveryReady() ||
      !!this.pending()
  );
  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((scope) => {
        this.version++;
        this.sessionChanged.next();
        this.readChanged.next();
        if (this.scope !== null) this.recovery.clear();
        this.scope = scope;
        this.file = null;
        this.currentId = null;
        this.pending.set(null);
        this.items.set([]);
        this.saving.set(false);
        this.loading.set(false);
        this.recoveryReady.set(false);
        this.recovering.set(false);
        this.error.set('');
        this.listError.set('');
        this.feedback.set('');
        this.signedIn.set(scope !== null);
        this.sessionVersion.update((value) => value + 1);
        if (scope !== null) this.restore();
      });
    this.destroy.onDestroy(() => {
      this.stopped = true;
      this.sessionChanged.next();
      this.readChanged.next();
    });
  }
  restore() {
    const scope = this.scope;
    if (!scope || this.saving() || this.recovering()) return;
    const version = this.version;
    this.recovering.set(true);
    this.recovery
      .restore(scope)
      .pipe(
        takeUntil(this.sessionChanged),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(
              new Error(
                'Image retry recovery is unavailable. Reload recovery before changing images.'
              )
            )
          )
        )
      )
      .subscribe((result) => {
        if (!this.current(version)) return;
        this.recovering.set(false);
        this.recoveryReady.set(result.ok);
        if (result.ok) {
          this.pending.set(result.value);
          this.error.set('');
        } else this.error.set(result.error.message);
      });
  }
  open(draftId: string) {
    this.currentId = draftId;
    this.reload();
  }
  reload() {
    this.readChanged.next();
    this.items.set([]);
    this.listError.set('');
    const id = this.currentId;
    if (!id || !this.scope) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.port
      .list(id)
      .pipe(
        takeUntil(this.sessionChanged),
        takeUntil(this.readChanged),
        takeUntilDestroyed(this.destroy),
        catchError(() =>
          of(
            err(new Error('Application images could not be loaded. Try again.'))
          )
        )
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result.ok) this.items.set(result.value);
        else this.listError.set(result.error.message);
      });
  }
  select(file: File, purpose: ApplicationImagePurpose) {
    if (this.blocked() || !this.currentId) return;
    const draftId = this.currentId,
      version = this.version;
    this.saving.set(true);
    this.error.set('');
    void (async () => {
      try {
        const source = await this.value(this.port.inspect(file), version);
        this.file = file;
        await this.execute(
          {
            intent: {
              type: 'reserve',
              draftId,
              input: { draftId, purpose, source },
            },
            key: crypto.randomUUID(),
          },
          version
        );
      } catch (error) {
        this.failure(error, version);
      } finally {
        if (this.current(version)) this.saving.set(false);
      }
    })();
  }
  resume(upload: ApplicationImageUpload, file: File) {
    if (
      this.blocked() ||
      upload.status !== 'pending' ||
      upload.draftId !== this.currentId
    )
      return;
    this.file = file;
    this.start({
      type: 'upload',
      draftId: upload.draftId,
      id: upload.id,
      expectedRevision: upload.revision,
      source: upload.source,
    });
  }
  cancel(upload: ApplicationImageUpload) {
    if (this.blocked() || upload.draftId !== this.currentId) return;
    this.start({
      type: 'cancel',
      draftId: upload.draftId,
      id: upload.id,
      expectedRevision: upload.revision,
    });
  }
  attach(
    draft: ApplicationDraft,
    purpose: ApplicationImagePurpose,
    imageId: string | null
  ) {
    if (this.blocked() || draft.id !== this.currentId) return;
    try {
      this.start({
        type: 'attach',
        draftId: draft.id,
        input: parseApplicationImageChange({
          expectedRevision: draft.revision,
          purpose,
          imageId,
        }),
      });
    } catch (error) {
      this.failure(error, this.version);
    }
  }
  retry(file?: File) {
    const attempt = this.pending();
    if (!attempt || this.saving() || this.recovering() || !this.recoveryReady())
      return;
    if (file) this.file = file;
    this.start(attempt.intent, attempt.key);
  }
  cancelPendingUpload() {
    const attempt = this.pending();
    if (
      !attempt ||
      !['reserve', 'upload'].includes(attempt.intent.type) ||
      this.saving() ||
      !this.recoveryReady()
    )
      return;
    const version = this.version;
    this.saving.set(true);
    this.error.set('');
    void (async () => {
      const intent = attempt.intent;
      if (intent.type !== 'reserve' && intent.type !== 'upload') return;
      let current: ApplicationImageUpload;
      try {
        const id =
          intent.type === 'reserve'
            ? (
                await this.value(
                  this.port.reserve(intent.input, attempt.key),
                  version
                )
              ).id
            : intent.id;
        current = await this.value(this.port.read(id), version);
      } catch (error) {
        if (
          !(error instanceof ApplicationDraftRequestError) ||
          error.uncertain ||
          error.status !== 404
        )
          throw error;
        await this.value(
          this.recovery.remember(this.sessionScope(), null),
          version
        );
        this.pending.set(null);
        this.file = null;
        this.feedback.set(
          'This draft or upload is no longer accessible. Its local retry has been cleared.'
        );
        this.reload();
        return;
      }
      this.file = null;
      if (current.status === 'cancelled') {
        await this.value(
          this.recovery.remember(this.sessionScope(), null),
          version
        );
        this.pending.set(null);
        this.feedback.set('This upload is already cancelled.');
        this.reload();
      } else
        await this.execute(
          {
            key: crypto.randomUUID(),
            intent: {
              type: 'cancel',
              draftId: intent.draftId,
              id: current.id,
              expectedRevision: current.revision,
            },
          },
          version
        );
    })()
      .catch((error: unknown) => this.failure(error, version))
      .finally(() => {
        if (this.current(version)) this.saving.set(false);
      });
  }
  private start(
    intent: ApplicationMediaIntent,
    key: string = crypto.randomUUID()
  ) {
    if (!this.scope || !this.session.currentKey()) return;
    const version = this.version;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    void this.execute({ intent, key }, version)
      .catch((error: unknown) => this.failure(error, version))
      .finally(() => {
        if (this.current(version)) this.saving.set(false);
      });
  }
  private async execute(
    attempt: ApplicationMediaAttempt,
    version: number
  ): Promise<void> {
    this.assertCurrent(version);
    this.pending.set(attempt);
    await this.value(
      this.recovery.remember(this.sessionScope(), attempt),
      version
    );
    const { intent, key } = attempt;
    let changed: ApplicationDraftReceipt | null = null;
    let uploadReady = true;
    try {
      if (intent.type === 'reserve') {
        if (this.file)
          await this.exactFile(this.file, intent.input.source, version);
        const receipt = await this.value(
          this.port.reserve(intent.input, key),
          version
        );
        return this.execute(
          {
            intent: {
              type: 'upload',
              draftId: intent.draftId,
              id: receipt.id,
              expectedRevision: receipt.revision,
              source: intent.input.source,
            },
            key: crypto.randomUUID(),
          },
          version
        );
      }
      if (intent.type === 'upload') {
        if (!this.file) {
          this.feedback.set(
            'Select the exact original file to resume this reserved upload.'
          );
          return;
        }
        await this.exactFile(this.file, intent.source, version);
        await this.value(
          this.port.upload(intent.id, intent.expectedRevision, this.file, key),
          version
        );
      } else if (intent.type === 'cancel')
        await this.value(
          this.port.cancel(intent.id, intent.expectedRevision, key),
          version
        );
      else
        changed = await this.value(
          this.port.attach(intent.draftId, intent.input, key),
          version
        );
    } catch (error) {
      if (
        this.current(version) &&
        error instanceof ApplicationDraftRequestError &&
        !error.uncertain
      ) {
        await this.value(
          this.recovery.remember(this.sessionScope(), null),
          version
        );
        this.pending.set(null);
        this.file = null;
        this.reload();
      }
      throw error;
    }
    if (intent.type === 'upload') {
      try {
        const current = await this.value(this.port.read(intent.id), version);
        uploadReady = current.status === 'ready';
      } catch (error) {
        if (
          !(error instanceof ApplicationDraftRequestError) ||
          error.uncertain ||
          error.status !== 404
        )
          throw error;
        uploadReady = false;
      }
    }
    await this.value(
      this.recovery.remember(this.sessionScope(), null),
      version
    );
    this.pending.set(null);
    this.file = null;
    this.feedback.set(
      intent.type === 'upload'
        ? uploadReady
          ? 'Upload confirmed. Choose Use image to attach it to the saved draft.'
          : 'This upload is no longer ready or accessible. Reload uploads before choosing an image.'
        : intent.type === 'cancel'
        ? 'Unused upload cancelled. Its bytes are queued for cleanup.'
        : 'Draft image saved. Submit the draft for review to publish this change.'
    );
    this.reload();
    if (changed) this.changed.next(changed);
  }
  private async exactFile(
    file: File,
    source: ApplicationImageSource,
    version: number
  ) {
    const actual = await this.value(this.port.inspect(file), version);
    if (
      actual.sha256 !== source.sha256 ||
      actual.bytes !== source.bytes ||
      actual.contentType !== source.contentType
    )
      throw new Error(
        'Select the exact original file for this upload. Its content, size and format must match.'
      );
  }
  private async value<T>(
    request: Observable<Result<T, Error>>,
    version: number
  ) {
    this.assertCurrent(version);
    const result = await firstValueFrom(
      request.pipe(takeUntil(this.sessionChanged))
    );
    this.assertCurrent(version);
    if (!result.ok) throw result.error;
    return result.value;
  }
  private sessionScope() {
    const scope = this.scope;
    if (!scope)
      throw new Error('The account changed. Reopen application images.');
    return scope;
  }
  private current(version: number) {
    return (
      !this.stopped &&
      this.version === version &&
      !!this.scope &&
      this.session.currentKey() === this.scope
    );
  }
  private assertCurrent(version: number) {
    if (!this.current(version))
      throw new Error('The account changed. Reopen application images.');
  }
  private failure(error: unknown, version: number) {
    if (this.current(version))
      this.error.set(
        error instanceof Error
          ? error.message
          : 'The image operation could not be confirmed. Retry the same request.'
      );
  }
}
