import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { Component, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of, map } from 'rxjs';
import { TuiIcon, TuiLink, TuiAppearance, TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { 
  PageHeaderComponent,
  StickyHeaderDirective,
  PageTitleComponent, 
  PageTitleSkeletonComponent,
  MediumCardSkeletonComponent,
  MediumCardComponent,
  ContentStateComponent
} from '@ui/layout';
import { TagsComponent } from '@ui/tags';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { CATEGORIES, PLATFORMS, TAGS } from '@portals/shared/data';
import { PreferredDatePipe } from '@portals/shared/features/preferences';
import { CATALOG_ENTRIES } from '@portals/shared/features/listing';
import { DiscussionSmallCardComponent } from '@portals/shared/features/discussion';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';
import { RoutePathPipe } from '@ui/routing';
import { 
  AppAvatarComponent, 
  AppRatingComponent,
  AppCategoryChipComponent,
  LocalDiscussionsService,
  APPLICATION_OVERVIEW_PROVIDER 
} from '@portals/shared/features/application-overview';

@Component({
  selector: 'app-application-overview-page',
  standalone: true,
  imports: [
    ContentStateComponent,
    CommonModule, FavoriteToggleButtonComponent,
    RouterLink,
    RoutePathPipe,
    TuiIcon, TuiButton,
    TuiLink,
    TuiBadge,
    TuiAppearance,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    StickyHeaderDirective,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    MediumCardSkeletonComponent,
    MediumCardComponent,
    PreferredDatePipe,
    DiscussionSmallCardComponent,
    TagsComponent,
    CoverImageComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppCategoryChipComponent,
  ],
  templateUrl: './application-overview-page.component.html',
  styleUrl: './application-overview-page.component.scss'
})
export class ApplicationOverviewPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  private readonly _overviewProvider = inject(APPLICATION_OVERVIEW_PROVIDER);
  private readonly _discussions = inject(LocalDiscussionsService);

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      if (!appSlug) return of(null);
      return this._overviewProvider.getOverview(appSlug).pipe(map(result => {
        if (!result.ok) throw result.error;
        return result.value;
      }));
    }
  });

  public readonly notFound = computed(() => {
    const error = this.app.error() as { status?: number } | undefined;
    return error?.status === 404 || (!this.app.isLoading() && !error && !this.app.value());
  });
  public readonly overviewData = {
    isLoading: () => this.app.isLoading(),
    value: () => this.app.value() ? this._buildOverviewData() : null
  };

  // Navigation paths
  readonly HEALTH_PATH = '/' + NAVIGATION.applicationHealth.path;
  readonly REVIEWS_PATH = '/' + NAVIGATION.applicationReviews.path;
  readonly TIMELINE_PATH = '/' + NAVIGATION.applicationTimeline.path;
  readonly DISCUSSIONS_PATH = '/' + NAVIGATION.applicationDiscussions.path;
  readonly DEVLOG_PATH = '/' + NAVIGATION.applicationDevLog.path;

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb().map(item => ({ ...item, path: '/' + item.path.replace(/^\/+/, '').replace(':appSlug', encodeURIComponent(this.appSlug() ?? '')) }));
    
    if (this.app.value()) { 
      return breadcrumb.map((b) => {
        if (b.label.includes(NAVIGATION_NAME_PARAMS.applicationName)) {
          return {
            ...b,
            label: b.label.replace(NAVIGATION_NAME_PARAMS.applicationName, this.app.value()?.name ?? 'Unknown Application')
          };
        }
        return b;
      });
    }
    return breadcrumb;
  });

  public readonly shortcuts = computed(() => {
    return this.overviewData.value()?.shortcuts ?? [];
  });

  public readonly recentDiscussions = computed(() =>
    this._discussions.previews(this.app.value()?.slug ?? null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.slug.localeCompare(b.slug))
      .slice(0, 2)
  );

  public readonly includedSuites = computed(() => {
    const slug = this.app.value()?.slug;
    if (!slug) return [];
    return CATALOG_ENTRIES.filter(entry => entry.kind === 'suites' && entry.applications?.some(app => app.slug === slug))
      .map(suite => ({ ...suite, members: [...new Map((suite.applications ?? []).map(app => [app.slug || app.name, app])).values()] }));
  });

  getCoverImage(): CoverImageDto {
    return {
      url: this.app.value()?.logo ?? '',
      alt: this.app.value()?.name ?? 'Application cover'
    };
  }

  private _buildOverviewData() {
    const app = this.app.value();
    return {
      platforms: PLATFORMS.filter(platform => app?.platformIds?.includes(platform.id)).map(platform => platform.name),
      pricingModels: (app?.monetizations ?? []).map(plan => plan.name).filter(Boolean),
      estimatedUsers: app && Number.isFinite(app.number) && app.number >= 0 ? app.number : null,
      category: (() => {
        const category = CATEGORIES.find(c => String(c.id) === String(this.app.value()?.categoryId));
        return { name: category?.name ?? 'Uncategorized', slug: category?.slug ?? '', link: category ? '/categories/' + category.slug : '/categories' };
      })(),
      tags: TAGS.filter(t => this.app.value()?.tagIds.includes(String(t.id))).map(t => ({ ...t, link: '/tags/' + t.slug })),
      aggregatedScore: this.app.value()?.rating ?? 0,
      reviewsCount: this.app.value()?.reviewNumber ?? 0,
      shortcuts: [
        { icon: '@tui.heart-pulse', title: 'Health Status', description: 'View system status and uptime', path: this.HEALTH_PATH, colorClass: 'health-icon' },
        { icon: '@tui.star', title: 'Reviews', description: 'Read user testimonials', path: this.REVIEWS_PATH, colorClass: 'reviews-icon' },
        { icon: '@tui.git-commit', title: 'Changelog', description: 'Recent updates and releases', path: this.DEVLOG_PATH, colorClass: 'timeline-icon' },
        { icon: '@tui.message-circle', title: 'Discussions', description: 'Join community conversations', path: this.DISCUSSIONS_PATH, colorClass: 'discussions-icon' }
      ]
    };
  }
}
