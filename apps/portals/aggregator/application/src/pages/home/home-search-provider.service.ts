import { inject, Injectable } from '@angular/core';
import { map, of } from 'rxjs';
import { DiscoverySearchResultType } from '@domains/discovery';
import { DiscoverySearchService } from '@portals/shared/features/search';
import { IMultiSearchResultsProvider } from '@portals/shared/features/multi-search';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { NAVIGATION } from '../../navigation';

@Injectable()
export class HomeSearchProviderService implements IMultiSearchResultsProvider {
  private readonly searchService = inject(DiscoverySearchService);

  getRecentSearches() {
    return this.searchService.recentSearches$.pipe(map(searches => ({
      ok: true as const,
      value: { searches: searches.map(search => ({
        name: search, link: '/' + NAVIGATION.discover.path, query: { search },
      })) },
    })));
  }

  search(params: Record<string, string>) {
    const result = this.searchService.search(params);
    return of({ ok: true as const, value: {
      ...result,
      link: '/' + NAVIGATION.discover.path,
      groups: result.groups.map(group => ({
        ...group,
        link: '/' + NAVIGATION.discover.path,
        entries: group.entries.slice(0, 3).map(entry => ({
          ...entry,
          link: '/' + (group.type === DiscoverySearchResultType.Application
            ? buildRoutePath(NAVIGATION.application.path, { appSlug: entry.slug })
            : group.type === DiscoverySearchResultType.Article
              ? buildRoutePath(NAVIGATION.article.path, { articleSlug: entry.slug })
              : buildRoutePath(NAVIGATION.suite.path, { suiteSlug: entry.slug })),
        })),
      })),
    } });
  }
}
