import { ChangeDetectionStrategy, Component, inject, ViewChild, AfterViewInit, DestroyRef } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { combineLatest, map, shareReplay, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchBarComponent } from '@ui/search-bar';
import { DiscoverySearchService } from '@portals/shared/features/search';
import { NAVIGATION } from '../../navigation';
import { buildRoutePath } from '@portals/shared/boundary/navigation';
import { IntersectDirective } from '@ui/misc';
import { GlobalStateService } from '../../state/global-state.service';
import { TuiAppearance, TuiButton, TuiLink } from '@taiga-ui/core';
import { TuiDropdownOpen, TuiDropdownDirective, TuiDropdownOptionsDirective } from '@taiga-ui/core/directives/dropdown';
import { FiltersMultiselectComponent } from '@ui/filters';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import { IBreadcrumbRouteData } from '@portals/shared/boundary/navigation';
import {
  PageHeaderComponent,
  PageTitleComponent,
  CommonSectionComponent,
  ElevatedCardSkeletonComponent,
  MediumCardComponent,
  CardHeaderComponent,
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
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';
import { DiscussionChipComponent } from '@portals/shared/features/discussion';
import { AppAvatarComponent, AppRatingComponent, AppVotingChipComponent } from '@portals/shared/features/application-overview';
import { SuiteAppAvatarsComponent } from '@portals/shared/features/suite';
import { TopReviewCardComponent } from '@portals/shared/features/review';
@Component({
  selector: 'discover-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    SearchBarComponent,
    FiltersBarComponent,
    FiltersMultiselectComponent,
    TuiDropdownOpen,
    TuiDropdownDirective,
    TuiDropdownOptionsDirective,
    IntersectDirective,
    TuiAppearance,
    TuiButton,
    TuiLink,
    TuiBadgedContent,
    BreadcrumbsComponent,
    PageHeaderComponent,
    PageTitleComponent,
    AsyncPipe,
    CommonSectionComponent,
    MediumCardComponent,
    MediumTitleSkeletonComponent,
    MediumTitleComponent,
    ElevatedCardSkeletonComponent,
    CardHeaderComponent,
    CoverImageComponent,
    TagsComponent,
    TagsSkeletonComponent,
    ExcerptComponent,
    ExcerptSkeletonComponent,
    ArticleAuthorInfoComponent,
    ArticleAuthorInfoSkeletonComponent,
    FavoriteToggleButtonComponent,
    ProfileBadgesComponent,
    DiscussionChipComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppVotingChipComponent,
    SuiteAppAvatarsComponent,
    TopReviewCardComponent,
    MediumCardSkeletonComponent
  ],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  host: {
    'class': 'fluid-container'
  },
})
export class DiscoverPageComponent implements AfterViewInit {
  @ViewChild(SearchBarComponent) private searchBar!: SearchBarComponent;
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly searchService = inject(DiscoverySearchService);

  ngAfterViewInit(): void {
    this._route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.searchBar.form.controls.search.setValue(params.get('search') ?? params.get('q') ?? '', { emitEvent: false });
    });
  }

  protected submitSearch(event?: Event): void {
    event?.preventDefault();
    this.changeSearch(this.searchBar.form.controls.search.value);
  }

  protected changeSearch(phrase: string | null): void {
    void this.router.navigate([], {
      relativeTo: this._route,
      queryParams: { search: phrase?.trim() || null, q: null, page: null }, queryParamsHandling: 'merge',
    });
  }

  protected readonly initialSearch = inject(ActivatedRoute).snapshot.queryParamMap.get('search') ?? inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '';


  private readonly _globalState = inject(GlobalStateService);
  private readonly _route = inject(ActivatedRoute);

  protected readonly resultsData$ = combineLatest([this._route.queryParamMap, this._route.paramMap]).pipe(
    map(([query, path]) => ({
      ...Object.fromEntries(query.keys.map(key => [key, query.getAll(key).join(',')])),
      ...(path.get('category') ? { category: path.get('category')! } : {}),
    })),
    map(params => ({ ...this.searchService.search(params), isLoading: false })),
    tap(data => {
      this.searchService.remember(data.query['search']);
      this._globalState.activeSection$.next(null);
      this._globalState.setSearchResultsData(data);
    }),
    // Keep card inputs stable through navigation, image loads and filter-menu events.
    map(data => ({
      ...data,
      groups: data.groups.map(group => ({
        ...group,
        entries: group.entries.map(entry => {
          switch (group.type) {
            case DiscoverySearchResultType.Article: return this.toArticleVM(entry as DiscoverySearchResultArticleItemDto);
            case DiscoverySearchResultType.Application: return this.toApplicationVM(entry);
            case DiscoverySearchResultType.Suite: return this.toSuiteVM(entry);
          }
        }),
      })),
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly breadcrumbs$ = this._route.data.pipe(
    map((data) => (data as IBreadcrumbRouteData)?.breadcrumb || [])
  );



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
        link: '/' + buildRoutePath(NAVIGATION.tag.path, { tagSlug: tag.slug })
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
      title: articleEntry.title || articleEntry.name,
      articleLink: '/' + buildRoutePath(NAVIGATION.article.path, { articleSlug: articleEntry.slug }),
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
        link: '/' + buildRoutePath(NAVIGATION.category.path, { categorySlug: appEntry.category.slug })
      },
      tags: appEntry.tags.map((tag: any) => ({
        slug: tag.slug,
        name: tag.name,
        link: '/' + buildRoutePath(NAVIGATION.tag.path, { tagSlug: tag.slug })
      })),
      voting: {
        upvotesCount: appEntry.upvotesCount || 0,
        downvotesCount: appEntry.downvotesCount || 0
      },
      commentsNumber: appEntry.commentsNumber || 0,
      applicationLink: '/' + buildRoutePath(NAVIGATION.applicationOverview.path, { appSlug: appEntry.slug }),
      reviewsLink: '/' + buildRoutePath(NAVIGATION.applicationReviews.path, { appSlug: appEntry.slug }),
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
        link: '/' + buildRoutePath(NAVIGATION.tag.path, { tagSlug: tag.slug })
      })),
      voting: {
        upvotesCount: suiteEntry.upvotesCount || 0,
        downvotesCount: suiteEntry.downvotesCount || 0
      },
      commentsNumber: suiteEntry.commentsNumber || 0,
      applications: suiteEntry.applications || [],
      suiteLink: '/' + buildRoutePath(NAVIGATION.suite.path, { suiteSlug: suiteEntry.slug }),
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

  getGroupLabel(arg0: DiscoverySearchResultType) {
    const labelMap: Record<DiscoverySearchResultType, { icon: string, value: string }> = {
      [DiscoverySearchResultType.Suite]: { icon: '@tui.briefcase-business', value: 'Suites' },
      [DiscoverySearchResultType.Application]: { icon: '@tui.layout-grid', value: 'Applications' },
      [DiscoverySearchResultType.Article]: { icon: '@tui.newspaper', value: 'Articles' }
    };
    return labelMap[arg0];
  }
}
