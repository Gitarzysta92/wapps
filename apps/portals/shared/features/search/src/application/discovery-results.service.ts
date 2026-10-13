import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  Subject,
  take,
  takeUntil,
} from 'rxjs';
import {
  DiscoveryInputError,
  parsePublicDiscoveryQuery,
  selectPublicDiscovery,
  type PublicDiscoveryQuery,
} from '@domains/discovery';
import { PreferencesService } from '@portals/shared/features/preferences';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { PUBLIC_DISCOVERY } from './public-discovery.port';
import { DiscoverySearchService } from './discovery-search.service';

@Injectable()
export class DiscoveryResultsService {
  private readonly port = inject(PUBLIC_DISCOVERY);
  private readonly preferences = inject(PreferencesService);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly recent = inject(DiscoverySearchService);
  private readonly destroy = inject(DestroyRef);
  private readonly request = new BehaviorSubject<Record<
    string,
    string | string[]
  > | null>(null);
  private readonly changed = new Subject<void>();
  private generation = 0;
  private fingerprint = '';
  readonly query = signal<PublicDiscoveryQuery | null>(null);
  readonly groups = signal<ReturnType<typeof selectPublicDiscovery> | null>(
    null
  );
  readonly loading = signal(false);
  readonly error = signal('');
  readonly invalid = signal(false);
  readonly view = signal<'grid' | 'list'>('grid');
  readonly recentSearches$ = this.recent.recentSearches$;

  constructor() {
    combineLatest([
      this.request,
      this.preferences.preferences$,
      this.session.token$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([request, preferences, token]) => {
        const fingerprint = JSON.stringify([
          request,
          token,
          preferences.sessionKey,
          preferences.isLoading,
          preferences.isError,
          preferences.data.display.defaultView,
          preferences.data.display.itemsPerPage,
          preferences.data.content.contentFilters.excludedCategories,
          preferences.data.content.showMatureContent,
        ]);
        if (fingerprint === this.fingerprint) return;
        this.fingerprint = fingerprint;
        this.reload();
      });
  }
  search(params: Record<string, string | string[]>) {
    this.request.next(params);
  }
  reload() {
    this.changed.next();
    const generation = ++this.generation;
    this.groups.set(null);
    this.error.set('');
    this.invalid.set(false);
    this.loading.set(false);
    this.query.set(null);
    const params = this.request.value;
    if (!params) return;
    const preferences = this.preferences.state(),
      token = this.session.getToken();
    if (preferences.isLoading || preferences.sessionKey !== token) {
      this.loading.set(true);
      return;
    }
    if (preferences.isError) {
      this.error.set(
        'Your saved choices could not be loaded. Retry your settings.'
      );
      return;
    }
    let query: PublicDiscoveryQuery;
    try {
      const { view, ...filters } = params;
      if (view !== undefined && view !== 'grid' && view !== 'list')
        throw new DiscoveryInputError('Choose grid or list view');
      this.view.set(view ?? preferences.data.display.defaultView);
      query = parsePublicDiscoveryQuery({
        ...filters,
        pageSize:
          filters['pageSize'] ?? String(preferences.data.display.itemsPerPage),
      });
      this.query.set(query);
    } catch (error) {
      this.invalid.set(true);
      this.error.set(
        error instanceof DiscoveryInputError
          ? error.message
          : 'Invalid Discover query'
      );
      return;
    }
    this.loading.set(true);
    defer(() => this.port.search(query))
      .pipe(take(1), takeUntil(this.changed), takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          if (
            generation !== this.generation ||
            token !== this.session.getToken()
          )
            return;
          this.loading.set(false);
          if (!result.ok) {
            this.error.set(result.error.message);
            return;
          }
          this.groups.set(
            selectPublicDiscovery(
              result.value,
              preferences.data.content.contentFilters.excludedCategories,
              preferences.data.content.showMatureContent
            )
          );
          if (query.search) this.recent.remember(query.search);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.error.set('Discover could not be loaded. Retry the search.');
        },
      });
  }
  retry() {
    if (this.preferences.isError()) this.preferences.reload();
    this.reload();
  }
}
