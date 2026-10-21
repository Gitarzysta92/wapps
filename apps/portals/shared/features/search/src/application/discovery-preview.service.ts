import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  combineLatest,
  defer,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  shareReplay,
} from 'rxjs';
import {
  parsePublicDiscoveryQuery,
  selectPublicDiscovery,
} from '@domains/discovery';
import {
  CatalogBrowserService,
  CatalogEntry,
  CatalogKind,
} from '@portals/shared/features/listing';
import {
  PreferencesService,
  PublicContentPreferencesService,
  requireContentChoice,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import { normalizeSearch } from './discovery-search';
import { PUBLIC_DISCOVERY } from './public-discovery.port';

export type DiscoveryPreviewEntry = Pick<
  CatalogEntry,
  | 'id'
  | 'revision'
  | 'slug'
  | 'name'
  | 'description'
  | 'image'
  | 'rating'
  | 'author'
  | 'articleCover'
> & { tags: { name: string; slug?: string }[] };

export interface DiscoveryPreview {
  search: string;
  total: number;
  groups: {
    kind: CatalogKind;
    total: number;
    hiddenCount: number;
    entries: DiscoveryPreviewEntry[];
  }[];
}

interface PreviewContext {
  status: 'ready' | 'loading' | 'unavailable';
  choice: PublicContentChoice | null;
  excludedCategories: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class DiscoveryPreviewService {
  private readonly catalog = inject(CatalogBrowserService);
  private readonly port =
    this.catalog.mode === 'api' ? inject(PUBLIC_DISCOVERY) : null;
  private readonly preferences = this.port ? inject(PreferencesService) : null;
  private readonly content = this.port
    ? inject(PublicContentPreferencesService)
    : null;
  private readonly context$ =
    this.preferences && this.content
      ? combineLatest([
          this.preferences.preferences$,
          this.content.changes$,
        ]).pipe(
          map(
            ([preferences, choice]): PreviewContext => ({
              status:
                preferences !== this.preferences?.state() ||
                choice !== this.content?.state()
                  ? 'loading'
                  : choice.status,
              choice,
              excludedCategories:
                preferences.data.content.contentFilters.excludedCategories,
            })
          ),
          distinctUntilChanged(
            (a, b) => JSON.stringify(a) === JSON.stringify(b)
          ),
          shareReplay({ bufferSize: 1, refCount: true })
        )
      : of<PreviewContext>({
          status: 'ready',
          choice: null,
          excludedCategories: [],
        });
  private readonly context = toSignal(this.context$, { requireSync: true });
  readonly availability$ = this.context$.pipe(
    map(({ status }) => ({
      status,
      message:
        status === 'loading'
          ? 'Loading content preferences...'
          : status === 'unavailable'
          ? 'Your content preferences could not be loaded. Retry the search to load them again.'
          : undefined,
    }))
  );

  retryPreferences(): boolean {
    if (this.context().status !== 'unavailable') return false;
    this.preferences?.reload();
    return true;
  }

  preview(phrase: string) {
    return defer(() => {
      const search = normalizeSearch(phrase);
      if (!search)
        return of<DiscoveryPreview>({ search, total: 0, groups: [] });
      if (this.port) {
        const context = this.context();
        const showMatureContent = requireContentChoice(context.choice);
        if (context.status !== 'ready')
          throw new Error('Loading content preferences...');
        if (search.length > 100)
          throw new Error('Use at most 100 characters for the search.');
        const query = parsePublicDiscoveryQuery({
          search,
          pageSize: '3',
          sort: 'name',
        });
        return this.port.search(query).pipe(
          map((result): DiscoveryPreview => {
            if (context !== this.context())
              throw new Error(
                'Your content choices changed. Retry the search.'
              );
            if (!result.ok) throw result.error;
            const groups = selectPublicDiscovery(
              result.value,
              context.excludedCategories,
              showMatureContent
            )
              .filter((group) => group.total > 0)
              .map((group) => ({
                kind: (
                  {
                    application: 'applications',
                    article: 'articles',
                    suite: 'suites',
                  } as const
                )[group.kind],
                total: group.total,
                hiddenCount: group.hidden,
                entries: group.items.map((item) => ({
                  id: item.id,
                  revision: item.revision,
                  slug: item.slug ?? item.id,
                  name: item.title,
                  description: item.summary,
                  tags: item.displayTags ?? [],
                  ...(item.details?.kind === 'application' ? { image: item.details.logoUrl ?? undefined, rating: item.details.reviews.rating ?? undefined } : {}),
                  ...(item.details?.kind === 'article' ? { author: item.details.byline,
                    ...(item.details.cover ? { articleCover: { articleId: item.id, ...item.details.cover } } : {}),
                  } : {}),
                })),
              }));
            return {
              search,
              total: groups.reduce((total, group) => total + group.total, 0),
              groups,
            };
          })
        );
      }
      return forkJoin(
        this.catalog.kinds.map((kind) =>
          this.catalog
            .browse({
              kind,
              search,
              category: '',
              tags: [],
              sort: 'name',
              page: 1,
              pageSize: 3,
            })
            .pipe(
              map((page) => ({
                kind,
                total: page.total,
                hiddenCount: 0,
                entries: page.items,
              }))
            )
        )
      ).pipe(
        map((groups) => ({
          search,
          total: groups.reduce((total, group) => total + group.total, 0),
          groups: groups.filter((group) => group.total > 0),
        }))
      );
    });
  }
}
