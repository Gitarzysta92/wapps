import {
  DestroyRef,
  Injectable,
  NgZone,
  computed,
  inject,
  signal,
} from '@angular/core';
import { defer, distinctUntilChanged, Subscription } from 'rxjs';
import type { AccountExportJob } from '@sdk/features/identity/core';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import { ACCOUNT_EXPORT, AccountExportError } from './account-export.port';
import { AccountExportIntent } from './account-export-intent';

@Injectable()
export class AccountExportEditorService {
  private readonly port = inject(ACCOUNT_EXPORT);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly intent = inject(AccountExportIntent);
  private readonly zone = inject(NgZone);
  readonly job = signal<AccountExportJob | null>(null);
  readonly signedIn = signal(false);
  readonly loaded = signal(false);
  readonly busy = signal<'read' | 'request' | 'cancel' | 'download' | null>(
    null
  );
  readonly feedback = signal('');
  readonly error = signal(false);
  readonly uncertain = signal(false);
  readonly active = computed(() =>
    ['queued', 'building', 'ready'].includes(this.job()?.status ?? '')
  );
  readonly canRequest = computed(
    () =>
      this.signedIn() &&
      !this.busy() &&
      (this.uncertain() || (this.loaded() && !this.active()))
  );
  private operation = new Subscription();
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  constructor() {
    const subscription = this.session.token$
      .pipe(distinctUntilChanged())
      .subscribe((token) => {
        this.clear();
        this.intent.bind(token);
        this.signedIn.set(!!token);
        this.uncertain.set(!!this.intent.key);
        this.refresh();
      });
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      this.clear();
    });
  }
  refresh(): void {
    if (!this.signedIn() || this.busy()) return;
    this.begin('read');
    const generation = this.generation;
    this.operation = defer(() => this.port.latest()).subscribe({
      next: (result) => {
        if (generation !== this.generation) return;
        if (result.ok) this.accept(result.value);
        else this.fail(result.error);
      },
      error: () =>
        this.fail(
          new AccountExportError(
            'unavailable',
            'Export status could not be loaded. Refresh to try again.'
          )
        ),
    });
  }
  request(): void {
    if (!this.canRequest()) return;
    this.begin('request');
    const generation = this.generation;
    this.operation = defer(() => {
      this.intent.key ??= this.port.newKey();
      return this.port.request(this.intent.key);
    }).subscribe({
      next: (result) => {
        if (generation !== this.generation) return;
        if (result.ok) {
          this.intent.key = null;
          this.uncertain.set(false);
          this.accept(result.value);
        } else this.requestFailed(result.error);
      },
      error: () =>
        this.requestFailed(
          new AccountExportError(
            'unavailable',
            'The export request could not be confirmed.'
          )
        ),
    });
  }
  cancel(): void {
    const job = this.job();
    if (
      !job ||
      !this.signedIn() ||
      this.busy() ||
      !this.loaded() ||
      !this.active()
    )
      return;
    this.begin('cancel');
    const generation = this.generation;
    this.operation = defer(() => this.port.cancel(job.id)).subscribe({
      next: (result) => {
        if (generation !== this.generation) return;
        if (result.ok) this.accept(result.value);
        else
          this.fail(
            result.error,
            'Removal could not be confirmed. Refresh the status before retrying.'
          );
      },
      error: () =>
        this.fail(
          new AccountExportError(
            'unavailable',
            'Removal could not be confirmed. Refresh the status before retrying.'
          )
        ),
    });
  }
  download(): void {
    const job = this.job();
    if (
      !job ||
      job.status !== 'ready' ||
      this.busy() ||
      !this.loaded() ||
      !this.signedIn()
    )
      return;
    this.begin('download');
    const generation = this.generation;
    this.operation = defer(() => this.port.download(job)).subscribe({
      next: (result) => {
        if (generation !== this.generation) return;
        if (!result.ok) {
          this.fail(result.error);
          return;
        }
        try {
          this.port.save(result.value, job.id);
          this.busy.set(null);
          this.feedback.set(
            'The verified archive was sent to your browser downloads.'
          );
          this.schedule(job);
        } catch {
          this.fail(
            new AccountExportError(
              'unavailable',
              'Your browser could not save the archive. Check download permissions and try again.'
            )
          );
        }
      },
      error: () =>
        this.fail(
          new AccountExportError(
            'unavailable',
            'Download failed. Refresh the export status and try again.'
          )
        ),
    });
  }
  private begin(operation: 'read' | 'request' | 'cancel' | 'download'): void {
    clearTimeout(this.timer);
    this.operation.unsubscribe();
    this.busy.set(operation);
    this.error.set(false);
    this.feedback.set('');
  }
  private accept(job: AccountExportJob | null): void {
    this.busy.set(null);
    this.loaded.set(true);
    this.job.set(job);
    if (job) this.schedule(job);
  }
  private requestFailed(error: AccountExportError): void {
    if (error.reason !== 'unavailable') this.intent.key = null;
    this.uncertain.set(!!this.intent.key);
    this.fail(
      error,
      this.uncertain()
        ? 'The request may already be saved. Retry the same request to recover its result.'
        : ''
    );
  }
  private fail(error: AccountExportError, detail = ''): void {
    this.busy.set(null);
    this.loaded.set(false);
    this.error.set(true);
    this.feedback.set([error.message, detail].filter(Boolean).join(' '));
  }
  private schedule(job: AccountExportJob): void {
    if (!['queued', 'building', 'ready'].includes(job.status)) return;
    const delay =
      job.status === 'ready'
        ? Math.max(1, Math.min(2_147_483_647, job.expiresAt - Date.now() + 10))
        : 2000;
    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => this.zone.run(() => this.refresh()), delay);
    });
  }
  private clear(): void {
    ++this.generation;
    clearTimeout(this.timer);
    this.operation.unsubscribe();
    this.job.set(null);
    this.loaded.set(false);
    this.busy.set(null);
    this.feedback.set('');
    this.error.set(false);
    this.uncertain.set(false);
  }
}
