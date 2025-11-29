import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { TuiBadge, TuiBadgedContent, TuiChip, TuiSkeleton } from '@taiga-ui/kit';
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
  type SuiteResultTileVM,
  TopReviewComponent
} from '@portals/shared/features/discovery-search-result';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RouterLink } from '@angular/router';
import { DiscussionIndicatorComponent } from '@ui/discussion';
import { TopCommentComponent } from '@portals/shared/features/discussion';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { IBreadcrumbRouteData } from '@portals/shared/boundary/navigation';
import { ElevatedCardComponent, MediumCardComponent, TitledSeparatorComponent } from '@ui/layout';
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
    RouterLink,
    DiscussionIndicatorComponent,
    TopCommentComponent,
    TopReviewComponent,
    TuiChip,
    TuiIcon,
    TuiBadge,
    TuiBadgedContent,
    BreadcrumbsComponent,
    AsyncPipe,
    TitledSeparatorComponent,
    MediumCardComponent,
    ElevatedCardComponent
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
  private readonly _route = inject(ActivatedRoute);

  protected readonly resultsData$ = of(DISCOVERY_SEARCH_RESULTS_DATA)
    .pipe(
      delay(1000),
      map(d => Object.assign({}, d, { isLoading: false })),
      startWith({ itemsNumber: 0, groups: [], link: "", query: {}, isLoading: true }));

  protected readonly breadcrumbs$ = this._route.data.pipe(
    map((data) => (data as IBreadcrumbRouteData)?.breadcrumb || [])
  );
  


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
      commentsLink: `/articles/${articleEntry.slug}#comments`,
      excerpt: articleEntry.excerpt
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
      reviewsLink: `/app/${appEntry.slug}/reviews`,
      topReview: appEntry.topReview ? {
        ...appEntry.topReview,
        authorBadges: [
          { name: 'verified', icon: '@tui.badge-check', appearance: 'primary-soft' },
          { name: 'premium', icon: '@tui.rocket', appearance: 'premium-soft' }
        ]
      } : null
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
      commentsLink: `/suites/${suiteEntry.slug}#comments`,
      topComment: suiteEntry.topComment ? {
        ...suiteEntry.topComment,
        discussionLink: `/suites/${suiteEntry.slug}#comments`,
        authorBadges: [
          { name: 'verified', icon: '@tui.badge-check', appearance: 'primary-soft' },
          { name: 'premium', icon: '@tui.rocket', appearance: 'premium-soft' }
        ]
      } : null
    };
  }

  protected onSaveSuite(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): void {
    // TODO: Implement save suite functionality
    console.log('Save suite:', entry);
  }

  protected onSaveApplication(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): void {
    // TODO: Implement save application functionality
    console.log('Save application:', entry);
  }

  protected onSaveArticle(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): void {
    // TODO: Implement save article functionality
    console.log('Save article:', entry);
  }

  getGroupLabel(arg0: DiscoverySearchResultType) {
    const labelMap: Record<DiscoverySearchResultType, { icon: string, value: string }> = {
      [DiscoverySearchResultType.Suite]: { icon: '@tui.briefcase-business', value: 'Suites' },
      [DiscoverySearchResultType.Application]: { icon: '@tui.layout-grid', value: 'Applications' },
      [DiscoverySearchResultType.Article]: { icon: '@tui.newspaper', value: 'Articles' }
    };
    return labelMap[arg0];
  }
}
