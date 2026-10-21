import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, finalize, map, of, Subject, takeUntil } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  RELEASE_PAGE_SIZE,
  parseReleaseBrowseFilter,
  type ReleaseBrowseFilter,
  type PublishedRelease,
} from '@domains/catalog/versioning';
import { RELEASE_CATALOG, ReleaseRequestError } from './release-workspace.port';

@Injectable()
export class ReleaseCatalogService {
  private readonly port = inject(RELEASE_CATALOG);
  private readonly destroy = inject(DestroyRef);
  private readonly changed = new Subject<void>();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly missing = signal(false);
  readonly items = signal<PublishedRelease[]>([]);
  readonly total = signal(0);
  readonly previous = signal<PublishedRelease[]>([]);
  readonly previousTotal = signal(0);
  readonly previousLoading = signal(false);
  readonly previousError = signal('');
  readonly pageSize = RELEASE_PAGE_SIZE;
  close() {
    this.changed.next();
    this.items.set([]);
    this.total.set(0);
    this.previous.set([]);
    this.previousTotal.set(0);
    this.previousError.set('');
    this.previousLoading.set(false);
    this.error.set('');
    this.missing.set(false);
    this.loading.set(false);
  }
  open(slug: string, version: string | null, page: number, channel = 'all') {
    this.close();
    if (!slug || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
      this.error.set('Choose a valid release page.');
      return;
    }
    let filter: ReleaseBrowseFilter;
    try {
      filter = parseReleaseBrowseFilter(channel === 'all' ? {} : { channel });
    } catch {
      this.error.set('Choose a valid release channel.');
      return;
    }
    this.loading.set(true);
    defer(() =>
      version === null
        ? this.port.browse(slug, page, filter)
        : this.port
            .find(slug, version)
            .pipe(
              map((result) =>
                result.ok
                  ? ok({ items: [result.value], total: 1, page: 1 })
                  : result
              )
            )
    )
      .pipe(
        catchError(() =>
          of(
            err(new Error('Release notes are unavailable. Try again shortly.'))
          )
        ),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.loading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) {
          this.items.set(result.value.items);
          this.total.set(result.value.total);
          if (version && result.value.items[0])
            this.loadPrevious(slug, result.value.items[0], page);
        } else {
          this.missing.set(
            result.error instanceof ReleaseRequestError &&
              result.error.status === 404
          );
          this.error.set(result.error.message);
        }
      });
  }
  private loadPrevious(slug: string, release: PublishedRelease, page: number) {
    this.previousLoading.set(true);
    defer(() => this.port.browse(slug, page, { before: release.releasedOn }))
      .pipe(
        catchError(() =>
          of(err(new Error('Previous releases are unavailable. Try again.')))
        ),
        takeUntil(this.changed),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.previousLoading.set(false))
      )
      .subscribe((result) => {
        if (result.ok) {
          this.previous.set(result.value.items);
          this.previousTotal.set(result.value.total);
        } else this.previousError.set(result.error.message);
      });
  }
}
