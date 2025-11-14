import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { TuiSkeleton } from '@taiga-ui/kit';
import { SearchResultsPageService } from './search-results-page.service';
import { 
  DiscoverySearchResultApplicationItemDto,
  DiscoverySearchResultArticleItemDto,
  DiscoverySearchResultSuiteItemDto, 
  DiscoverySearchResultGroupDto,
  DiscoverySearchResultType
} from '@domains/discovery';
import { delay, map, of, startWith } from 'rxjs';
import { DISCOVERY_SEARCH_RESULTS_DATA } from '@portals/shared/data';
import { IntersectDirective } from '@ui/misc';
import { GlobalStateService } from '../../state/global-state.service';
import { 
  ArticleResultTileComponent,
  ApplicationResultTileComponent,
  SuiteResultTileComponent,
  ArticleResultTileSkeletonComponent,
  ApplicationResultTileSkeletonComponent,
  SuiteResultTileSkeletonComponent,
  type ArticleResultTileVM,
  type ApplicationResultTileVM,
  type SuiteResultTileVM
} from '@portals/shared/features/discovery-search-result';
import { TuiButton } from '@taiga-ui/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    FiltersBarComponent,
    TuiSkeleton,
    IntersectDirective,
    ArticleResultTileComponent,
    ApplicationResultTileComponent,
    SuiteResultTileComponent,
    ArticleResultTileSkeletonComponent,
    ApplicationResultTileSkeletonComponent,
    SuiteResultTileSkeletonComponent,
    TuiButton,
    RouterLink
  ],
  providers: [
    SearchResultsPageService
  ],
  templateUrl: './search-results-page.component.html',
  styleUrl: './search-results-page.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  host: {
    'class': 'fluid-container'
  },
})
export class SearchResultsPageComponent {
  private readonly _globalState = inject(GlobalStateService);

  protected readonly resultsData$ = of(DISCOVERY_SEARCH_RESULTS_DATA)
    .pipe(
      delay(1000),
      map(d => Object.assign({}, d, { isLoading: false })),
      startWith({ itemsNumber: 0, groups: [], link: "", query: {}, isLoading: true }));
  


  constructor() {
    // Subscribe to resultsData$ and push it to the global state service
    this.resultsData$.subscribe(data => {
      this._globalState.setSearchResultsData(data);
    });
  }

  public onVisibilityChange(
    isVisible: boolean,
    element: Element,
    group: DiscoverySearchResultGroupDto
  ): void {
    if (isVisible) {
      this._globalState.activeSection$.next(group.type);
    }
  }

  protected readonly DiscoverySearchResultType = DiscoverySearchResultType;

  protected toArticleVM(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): ArticleResultTileVM {
    const articleEntry = entry as DiscoverySearchResultArticleItemDto;
    return {
      ...articleEntry,
      tags: articleEntry.tags.map(tag => ({ 
        ...tag, 
        link: `/search?tag=${tag.slug}` 
      })),
      articleLink: `/articles/${articleEntry.slug}`,
      commentsLink: `/articles/${articleEntry.slug}#comments`
    };
  }

  protected toApplicationVM(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): ApplicationResultTileVM {
    const appEntry = entry as DiscoverySearchResultApplicationItemDto;
    return {
      ...appEntry,
      category: {
        ...appEntry.category,
        link: `/search?category=${appEntry.category.slug}`
      },
      tags: appEntry.tags.map(tag => ({ 
        ...tag, 
        link: `/search?tag=${tag.slug}` 
      })),
      applicationLink: `/app/${appEntry.slug}/overview`,
      reviewsLink: `/app/${appEntry.slug}/reviews`
    };
  }

  protected toSuiteVM(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): SuiteResultTileVM {
    const suiteEntry = entry as DiscoverySearchResultSuiteItemDto;
    return {
      ...suiteEntry,
      tags: suiteEntry.tags.map(tag => ({ 
        ...tag, 
        link: `/search?tag=${tag.slug}` 
      })),
      suiteLink: `/suites/${suiteEntry.slug}`,
      commentsLink: `/suites/${suiteEntry.slug}#comments`
    };
  }

  protected onSaveSuite(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): void {
    // TODO: Implement save suite functionality
    console.log('Save suite:', entry);
  }
}
