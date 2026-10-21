import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import {
  DiscoveryPreviewService,
  DiscoverySearchService,
} from '@portals/shared/features/search';
import { CatalogKind } from '@portals/shared/features/listing';
import { IMultiSearchResultsProvider } from '@portals/shared/features/multi-search';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { NAVIGATION } from '../../navigation';

const groups: Record<CatalogKind, { name: string; icon: string }> = {
  applications: { name: 'Applications', icon: '@tui.layout-grid' },
  articles: { name: 'Articles', icon: '@tui.newspaper' },
  suites: { name: 'Suites', icon: '@tui.briefcase-business' },
};

@Injectable()
export class HomeSearchProviderService implements IMultiSearchResultsProvider {
  private readonly history = inject(DiscoverySearchService);
  private readonly preview = inject(DiscoveryPreviewService);
  private readonly link = '/' + NAVIGATION.discover.path;
  readonly availability$ = this.preview.availability$;

  retry() {
    return this.preview.retryPreferences();
  }

  getRecentSearches() {
    return this.history.recentSearches$.pipe(
      map((searches) => ({
        ok: true as const,
        value: {
          searches: searches.map((search) => ({
            name: search,
            link: this.link,
            query: { search },
          })),
        },
      }))
    );
  }

  search(params: Record<string, string>) {
    return this.preview.preview(params['search'] ?? '').pipe(
      map((result) => ({
        ok: true as const,
        value: {
          itemsNumber: result.total,
          query: { search: result.search },
          link: this.link,
          groups: result.groups.map((group) => ({
            ...groups[group.kind],
            id: group.kind,
            type: group.kind,
            link: this.link,
            total: group.total,
            hiddenCount: group.hiddenCount,
            entries: group.entries.map((entry) => ({
              id: entry.id ?? entry.slug,
              revision: entry.revision,
              groupId: group.kind,
              type: group.kind,
              name: entry.name,
              description: entry.description,
              coverImageUrl: { url: entry.image ?? '', alt: entry.name },
              articleCover: entry.articleCover,
              rating: entry.rating,
              authorName: entry.author,
              tags: entry.tags,
              link:
                '/' +
                (group.kind === 'applications'
                  ? buildRoutePath(NAVIGATION.application.path, {
                      appSlug: entry.slug,
                    })
                  : group.kind === 'articles'
                  ? buildRoutePath(NAVIGATION.article.path, {
                      articleSlug: entry.slug,
                    })
                  : buildRoutePath(NAVIGATION.suite.path, {
                      suiteSlug: entry.slug,
                    })),
            })),
          })),
        },
      }))
    );
  }
}
