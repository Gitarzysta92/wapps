import type { ContentClassification } from '@domains/publication/classification';
import { inject, Injectable, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
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
  parseSuiteFields,
  SUITE_LIMITS,
  type PrivateSuite,
  type SuiteReceipt,
} from '@domains/publication/suite';
import type { CatalogApp } from '@domains/catalog/record';
import {
  PRIVATE_SUITES,
  SUITE_SESSION,
  SuiteRequestError,
  type SuiteChange,
} from './private-suites.port';

@Injectable()
export class PrivateSuitesService {
  private readonly port = inject(PRIVATE_SUITES);
  private readonly session = inject(SUITE_SESSION);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  private readonly readChanged = new Subject<void>();
  private readonly searchChanged = new Subject<void>();
  private readonly metadataChanged = new Subject<void>();
  private attempt: { command: SuiteChange; key: string } | null = null;
  readonly signedIn = signal(false);
  readonly suites = signal<PrivateSuite[]>([]);
  readonly detail = signal<PrivateSuite | null>(null);
  readonly title = signal('');
  readonly description = signal('');
  readonly classification = signal<ContentClassification | undefined>(
    undefined
  );
  readonly selected = signal<string[]>([]);
  readonly members = signal<CatalogApp[]>([]);
  readonly results = signal<CatalogApp[]>([]);
  readonly searchText = signal('');
  readonly searchPage = signal(1);
  readonly searchPages = signal(1);
  readonly loading = signal(false);
  readonly searching = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly searchError = signal('');
  readonly metadataError = signal('');
  readonly metadataLoading = signal(false);
  readonly uncertain = signal(false);
  readonly sessionVersion = signal(0);

  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((key) => {
        this.changed.next();
        this.attempt = null;
        this.sessionVersion.update((value) => value + 1);
        this.signedIn.set(key !== null);
        this.suites.set([]);
        this.detail.set(null);
        this.title.set('');
        this.description.set('');
        this.classification.set(undefined);
        this.selected.set([]);
        this.members.set([]);
        this.results.set([]);
        this.error.set('');
        this.metadataError.set('');
        this.metadataLoading.set(false);
        this.searchError.set('');
        this.loading.set(false);
        this.saving.set(false);
        this.searching.set(false);
        this.uncertain.set(false);
      });
  }
  list() {
    this.readChanged.next();
    this.suites.set([]);
    this.error.set('');
    if (!this.signedIn()) return;
    this.loading.set(true);
    this.port
      .list()
      .pipe(
        takeUntil(this.changed),
        takeUntil(this.readChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) this.suites.set(result.value);
        else this.error.set(result.error.message);
      });
  }
  open(id: string | null) {
    this.readChanged.next();
    this.metadataChanged.next();
    this.searchChanged.next();
    this.detail.set(null);
    this.title.set('');
    this.description.set('');
    this.classification.set(undefined);
    this.selected.set([]);
    this.members.set([]);
    this.results.set([]);
    this.error.set('');
    this.metadataError.set('');
    this.loading.set(false);
    if (!this.signedIn() || !id) return;
    this.loading.set(true);
    this.port
      .read(id)
      .pipe(
        takeUntil(this.changed),
        takeUntil(this.readChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (!result.ok) {
          this.error.set(result.error.message);
          return;
        }
        this.detail.set(result.value);
        this.title.set(result.value.title);
        this.description.set(result.value.description);
        this.classification.set(result.value.classification);
        this.selected.set([...result.value.applicationIds]);
        this.resolve();
      });
  }
  search(text = this.searchText(), page = 1) {
    this.searchChanged.next();
    this.searchText.set(text);
    this.searchError.set('');
    this.results.set([]);
    if (!this.signedIn()) return;
    this.searching.set(true);
    this.port
      .search(text, page)
      .pipe(
        takeUntil(this.changed),
        takeUntil(this.searchChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.searching.set(false))
      )
      .subscribe((result) => {
        if (!result.ok) {
          this.searchError.set(result.error.message);
          return;
        }
        this.results.set(result.value.items);
        this.searchPage.set(result.value.page);
        this.searchPages.set(result.value.totalPages);
      });
  }
  resolve() {
    this.metadataChanged.next();
    this.metadataError.set('');
    this.members.set([]);
    this.metadataLoading.set(true);
    this.port
      .resolve(this.selected())
      .pipe(
        takeUntil(this.changed),
        takeUntil(this.metadataChanged),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.metadataLoading.set(false))
      )
      .subscribe((result) => {
        if (result.ok)
          this.members.update((current) =>
            [
              ...new Map(
                [...result.value, ...current].map((item) => [item.id, item])
              ).values(),
            ].filter((item) => this.selected().includes(item.id))
          );
        else
          this.metadataError.set(
            'Application details could not be loaded. Saved IDs are unchanged and can still be removed.'
          );
      });
  }
  select(app: CatalogApp) {
    if (this.saving() || this.uncertain() || this.selected().includes(app.id))
      return;
    if (this.selected().length >= SUITE_LIMITS.members) {
      this.error.set('Select at most 50 applications.');
      return;
    }
    this.selected.update((ids) => [...ids, app.id]);
    this.members.update((items) => [
      ...items.filter((item) => item.id !== app.id),
      app,
    ]);
  }
  remove(id: string) {
    if (this.saving() || this.uncertain()) return;
    this.selected.update((ids) => ids.filter((value) => value !== id));
    this.members.update((items) => items.filter((item) => item.id !== id));
  }
  member(id: string) {
    return this.members().find((item) => item.id === id);
  }
  save(): Observable<Result<SuiteReceipt, Error>> {
    return defer(() => {
      try {
        const fields = parseSuiteFields({
          title: this.title(),
          description: this.description(),
          classification: this.classification(),
          applicationIds: this.selected(),
        });
        const detail = this.detail();
        return this.change({
          type: detail ? 'update' : 'create',
          id: detail?.id ?? null,
          expectedRevision: detail?.revision ?? null,
          fields,
        });
      } catch (error) {
        const failure =
          error instanceof Error ? error : new Error('Invalid suite');
        this.error.set(failure.message);
        return of(err(failure));
      }
    });
  }
  delete() {
    const detail = this.detail();
    return detail
      ? this.change({
          type: 'delete',
          id: detail.id,
          expectedRevision: detail.revision,
          fields: null,
        })
      : of(err(new Error('Load the suite before deleting it.')));
  }
  retry() {
    return this.attempt
      ? this.change(this.attempt.command)
      : of(err(new Error('No pending change.')));
  }
  private change(
    command: SuiteChange
  ): Observable<Result<SuiteReceipt, Error>> {
    return defer(() => {
      if (
        !this.signedIn() ||
        this.session.currentKey() === null ||
        this.saving()
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
      this.attempt ??= { command, key: crypto.randomUUID() };
      this.saving.set(true);
      this.error.set('');
      return this.port.change(command, this.attempt.key).pipe(
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        tap((result) => {
          if (result.ok) {
            this.attempt = null;
            this.uncertain.set(false);
          } else {
            const uncertain =
              result.error instanceof SuiteRequestError &&
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
