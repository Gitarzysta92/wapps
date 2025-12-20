import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { TuiBadgedContent } from '@taiga-ui/kit';
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
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { IBreadcrumbRouteData } from '@portals/shared/boundary/navigation';
import { 
  CommonSectionComponent, 
  ElevatedCardComponent, 
  ElevatedCardSkeletonComponent,
  MediumCardComponent, 
  CardHeaderComponent,
  TitledSeparatorComponent, 
  MediumCardSkeletonComponent
} from '@ui/layout';
import { TagsComponent, TagsSkeletonComponent } from '@ui/tags';
import { 
  ExcerptComponent, 
  ExcerptSkeletonComponent,
  MediumTitleComponent,
  MediumTitleSkeletonComponent 
} from '@ui/content';
import { ArticleAuthorInfoComponent, ArticleAuthorInfoSkeletonComponent } from '@ui/article-author-info';
import { CoverImageComponent } from '@ui/cover-image';
import { ArticleRatingComponent, ArticleRatingSkeletonComponent } from '@portals/shared/features/articles';
import { MyFavoriteToggleComponent } from '@portals/shared/features/my-favorites';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';
import { DiscussionChipComponent } from '@portals/shared/features/discussion';
import { AppAvatarComponent, AppRatingComponent, AppVotingChipComponent } from '@portals/shared/features/app';
import { SuiteAppAvatarsComponent } from '@portals/shared/features/suite';
import { TopReviewCardComponent } from '@portals/shared/features/review';
@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    FiltersBarComponent,
    IntersectDirective,
    TuiButton,
    TuiIcon,
    TuiBadgedContent,
    BreadcrumbsComponent,
    AsyncPipe,
    TitledSeparatorComponent,
    CommonSectionComponent,
    MediumCardComponent,
    MediumTitleSkeletonComponent,
    MediumTitleComponent,
    ElevatedCardComponent,
    ElevatedCardSkeletonComponent,
    CardHeaderComponent,
    CoverImageComponent,
    TagsComponent,
    TagsSkeletonComponent,
    ExcerptComponent,
    ExcerptSkeletonComponent,
    ArticleAuthorInfoComponent,
    ArticleAuthorInfoSkeletonComponent,
    ArticleRatingComponent,
    MyFavoriteToggleComponent,
    ProfileBadgesComponent,
    DiscussionChipComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppVotingChipComponent,
    SuiteAppAvatarsComponent,
    TopReviewCardComponent,
    MediumCardSkeletonComponent
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

  protected toArticleVM(entry: DiscoverySearchResultArticleItemDto): any {
    const articleEntry = entry as any;
    return {
      ...articleEntry,
      tags: articleEntry.tags.map((tag: any) => ({ 
        slug: tag.slug,
        name: tag.name,
        link: `/search?tag=${tag.slug}` 
      })),
      coverImageUrl: articleEntry.coverImageUrl,
      rating: articleEntry.rating || 0,
      author: {
        name: articleEntry.authorName,
        avatarUrl: articleEntry.authorAvatarUrl || ''
      },
      authorBadges: [
        { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
        { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
      ],
      articleLink: `/articles/${articleEntry.slug}`,
      commentsLink: `/articles/${articleEntry.slug}#comments`,
      excerpt: articleEntry.excerpt
    };
  }

  protected toApplicationVM(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): any {
    const appEntry = entry as any;
    return {
      ...appEntry,
      id: appEntry.slug,
      title: appEntry.name,
      avatarUrl: appEntry.coverImageUrl || '',
      rating: appEntry.rating || 0,
      category: {
        ...appEntry.category,
        link: `/search?category=${appEntry.category.slug}`
      },
      tags: appEntry.tags.map((tag: any) => ({ 
        slug: tag.slug,
        name: tag.name,
        link: `/search?tag=${tag.slug}` 
      })),
      voting: {
        upvotesCount: appEntry.upvotesCount || 0,
        downvotesCount: appEntry.downvotesCount || 0
      },
      commentsNumber: appEntry.commentsNumber || 0,
      applicationLink: `/app/${appEntry.slug}/overview`,
      reviewsLink: `/app/${appEntry.slug}/reviews`,
      topReview: appEntry.topReview ? {
        ...appEntry.topReview,
        rating: appEntry.topReview.rate || 0,
        date: new Date().toLocaleDateString(),
        authorBadges: [
          { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
          { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
        ]
      } : null
    };
  }

  protected toSuiteVM(entry: DiscoverySearchResultArticleItemDto | DiscoverySearchResultApplicationItemDto | DiscoverySearchResultSuiteItemDto): any {
    const suiteEntry = entry as any;
    return {
      ...suiteEntry,
      id: suiteEntry.slug,
      title: suiteEntry.name,
      rating: suiteEntry.rating || 0,
      tags: suiteEntry.tags.map((tag: any) => ({ 
        slug: tag.slug,
        name: tag.name,
        link: `/search?tag=${tag.slug}` 
      })),
      voting: {
        upvotesCount: suiteEntry.upvotesCount || 0,
        downvotesCount: suiteEntry.downvotesCount || 0
      },
      commentsNumber: suiteEntry.commentsNumber || 0,
      applications: suiteEntry.applications || [],
      suiteLink: `/suites/${suiteEntry.slug}`,
      commentsLink: `/suites/${suiteEntry.slug}#comments`,
      topReview: suiteEntry.topComment ? {
        authorName: suiteEntry.topComment.authorName,
        authorAvatarUrl: suiteEntry.topComment.authorAvatarUrl || '',
        rating: 0,
        content: suiteEntry.topComment.content,
        date: new Date().toLocaleDateString(),
        authorBadges: [
          { id: 'verified', name: 'verified', icon: '@tui.badge-check', color: 'primary' },
          { id: 'premium', name: 'premium', icon: '@tui.rocket', color: 'premium-soft' }
        ]
      } : undefined
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
