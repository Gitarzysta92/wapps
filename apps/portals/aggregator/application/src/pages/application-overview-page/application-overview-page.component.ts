import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { Component, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TuiIcon, TuiLink, TuiAppearance, TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import {
  BreadcrumbsComponent,
  BreadcrumbsSkeletonComponent,
} from '@ui/breadcrumbs';
import {
  PageHeaderComponent,
  StickyHeaderDirective,
  PageTitleComponent,
  PageTitleSkeletonComponent,
  MediumCardSkeletonComponent,
  MediumCardComponent,
  ContentStateComponent,
} from '@ui/layout';
import { TagsComponent } from '@ui/tags';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import {
  IBreadcrumbRouteData,
  NavigationDeclarationDto,
  routingDataConsumerFrom,
  buildRoutePath,
} from '@portals/shared/boundary/navigation';
import {
  PreferredDatePipe,
} from '@portals/shared/features/preferences';
import {
  DiscussionSmallCardComponent,
  ApplicationDiscussionPreviewsComponent,
  mapApplicationDiscussionPreview,
} from '@portals/shared/features/discussion';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';
import { RoutePathPipe } from '@ui/routing';
import { ApplicationReviewSummaryComponent } from './application-review-summary.component';
import {
  AppAvatarComponent,
  AppRatingComponent,
  AppCategoryChipComponent,
  LocalDiscussionDraftsService,
  readApplicationContent,
  LOCAL_APPLICATION_DATA,
} from '@portals/shared/features/application-overview';

@Component({
  selector: 'app-application-overview-page',
  standalone: true,
  imports: [
    ContentStateComponent,
    CommonModule,
    FavoriteToggleButtonComponent,
    RouterLink,
    RoutePathPipe,
    TuiIcon,
    TuiButton,
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
    ApplicationReviewSummaryComponent,
    ApplicationDiscussionPreviewsComponent,
  ],
  templateUrl: './application-overview-page.component.html',
  styleUrl: './application-overview-page.component.scss',
})
export class ApplicationOverviewPageComponent
  implements
    routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }>
{
  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  private readonly _discussions = inject(LocalDiscussionDraftsService);

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);
  readonly content = readApplicationContent(() => this.appSlug() ?? '');
  readonly record = this.content.application;
  readonly loading = this.content.isLoading;
  readonly discussionPreview = mapApplicationDiscussionPreview;

  readonly discussionLink = (id: string) =>
    buildRoutePath('/' + NAVIGATION.applicationDiscussion.path, {
      appSlug: this.appSlug() ?? '',
      discussionSlug: id,
    });

  readonly preferencesLoading = computed(
    () => this.content.status() === 'preferences-loading'
  );
  readonly preferencesError = computed(
    () => this.content.status() === 'preferences-unavailable'
  );
  readonly hidden = computed(() => this.content.status() === 'hidden');
  retry() {
    this.content.reload();
  }

  public readonly notFound = computed(() => this.content.status() === 'missing');
  public readonly overviewData = {
    isLoading: () => this.loading(),
    value: () => (this.record() ? this._buildOverviewData() : null),
  };

  // Navigation paths
  readonly HEALTH_PATH = '/' + NAVIGATION.applicationHealth.path;
  readonly CLAIM_PATH = '/' + NAVIGATION.claimApplicationOwnership.path;
  readonly REVIEWS_PATH = '/' + NAVIGATION.applicationReviews.path;
  readonly memberReviewsLink = computed(() =>
    buildRoutePath(this.REVIEWS_PATH, { appSlug: this.record()?.slug ?? '' })
  );
  readonly TIMELINE_PATH = '/' + NAVIGATION.applicationTimeline.path;
  readonly DISCUSSIONS_PATH = '/' + NAVIGATION.applicationDiscussions.path;
  readonly DEVLOG_PATH = '/' + NAVIGATION.applicationDevLog.path;

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = (this.breadcrumb() ?? []).map((item) => ({
      ...item,
      path:
        '/' +
        item.path
          .replace(/^\/+/, '')
          .replace(':appSlug', encodeURIComponent(this.appSlug() ?? '')),
    }));

    if (this.record()) {
      return breadcrumb.map((b) => {
        if (b.label.includes(NAVIGATION_NAME_PARAMS.applicationName)) {
          return {
            ...b,
            label: b.label.replace(
              NAVIGATION_NAME_PARAMS.applicationName,
              this.record()?.name ?? 'Unknown Application'
            ),
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
    this._discussions
      .previews(this.record()?.slug ?? null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.slug.localeCompare(b.slug)
      )
      .slice(0, 2)
  );

  public readonly includedSuites = computed(
    () => this.record()?.includedSuites ?? []
  );

  getCoverImage(): CoverImageDto {
    return {
      url: this.record()?.banner ?? '',
      alt: this.record()?.name ?? 'Application cover',
    };
  }

  private _buildOverviewData() {
    const app = this.record();
    return {
      platforms: (app?.platforms ?? []).map((platform) => platform.name),
      pricingModels: (app?.monetizations ?? []).map((plan) => plan.name),
      estimatedUsers: app?.estimatedUsers ?? null,
      categories: (app?.categories ?? []).map((category) => ({
        ...category,
        link: '/categories/' + category.slug,
      })),
      tags: (app?.tags ?? []).map((tag) => ({
        ...tag,
        link: '/tags/' + tag.slug,
      })),
      aggregatedScore: app?.reviews?.rating ?? null,
      reviewsCount: app?.reviews?.total ?? null,
      shortcuts: [
        {
          icon: '@tui.heart-pulse',
          title: 'Health Status',
          description: 'View system status and uptime',
          path: this.HEALTH_PATH,
          colorClass: 'health-icon',
        },
        {
          icon: '@tui.star',
          title: 'Reviews',
          description: 'Read user testimonials',
          path: this.REVIEWS_PATH,
          colorClass: 'reviews-icon',
        },
        {
          icon: '@tui.git-commit',
          title: 'Changelog',
          description: 'Recent updates and releases',
          path: this.DEVLOG_PATH,
          colorClass: 'timeline-icon',
        },
        {
          icon: '@tui.message-circle',
          title: 'Discussions',
          description: 'Join community conversations',
          path: this.DISCUSSIONS_PATH,
          colorClass: 'discussions-icon',
        },
      ],
    };
  }
}
