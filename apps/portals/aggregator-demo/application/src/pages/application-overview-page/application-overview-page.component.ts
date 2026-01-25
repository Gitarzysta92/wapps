import { Component, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of, delay } from 'rxjs';
import { TuiIcon, TuiLink, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { AppRecordDto } from '@domains/catalog/record';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { 
  PageHeaderComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent,
  PageMetaComponent,
  PageMetaSkeletonComponent,
  MediumCardComponent,
  MediumCardSkeletonComponent
} from '@ui/layout';
import { TagsComponent } from '@ui/tags';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS } from '@portals/shared/data';
import { NAVIGATION, NAVIGATION_NAME_PARAMS } from '../../navigation';
import { RoutePathPipe } from '@ui/routing';
import { 
  AppAvatarComponent, 
  AppRatingComponent,
  AppCategoryChipComponent,
  APPLICATION_OVERVIEW_PROVIDER 
} from '@portals/shared/features/application-overview';
import { HealthCheckBadgeComponent } from '@apps/portals/shared/features/health-status';
import { TopReviewCardComponent, type TopReview } from '@portals/shared/features/review';
import { ApplicationHealthStatusCode } from '@domains/feed';

@Component({
  selector: 'app-application-overview-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RoutePathPipe,
    TuiIcon,
    TuiLink,
    TuiBadge,
    TuiAppearance,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
    PageHeaderComponent,
    PageTitleComponent,
    PageTitleSkeletonComponent,
    PageMetaComponent,
    PageMetaSkeletonComponent,
    MediumCardComponent,
    MediumCardSkeletonComponent,
    TagsComponent,
    CoverImageComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppCategoryChipComponent,
    HealthCheckBadgeComponent,
    TopReviewCardComponent
  ],
  templateUrl: './application-overview-page.component.html',
  styleUrl: './application-overview-page.component.scss'
})
export class ApplicationOverviewPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  private readonly _overviewProvider = inject(APPLICATION_OVERVIEW_PROVIDER);

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug) ?? this._buildMockFromSlug(appSlug ?? 'unknown');
      return of(app).pipe(delay(1000));
    }
  });

  public readonly overviewData = rxResource({
    request: () => this.appSlug(),
    loader: () => of(this._generateMockOverviewData()).pipe(delay(1200))
  });

  // Navigation paths
  readonly HEALTH_PATH = '/' + NAVIGATION.applicationHealth.path;
  readonly REVIEWS_PATH = '/' + NAVIGATION.applicationReviews.path;
  readonly TIMELINE_PATH = '/' + NAVIGATION.applicationTimeline.path;
  readonly DISCUSSIONS_PATH = '/' + NAVIGATION.applicationDiscussions.path;
  readonly DEVLOG_PATH = '/' + NAVIGATION.applicationDevLog.path;

  public readonly breadcrumbData = computed(() => {
    const breadcrumb = this.breadcrumb();
    
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

  public readonly healthStatus = computed(() => {
    const data = this.overviewData.value();
    if (!data) return { code: ApplicationHealthStatusCode.Operational, message: 'Loading...' };
    return { code: data.healthStatus.code, message: data.healthStatus.message };
  });

  public readonly shortcuts = computed(() => {
    return this.overviewData.value()?.shortcuts ?? [];
  });

  public readonly latestReviews = computed(() => {
    return this.overviewData.value()?.latestReviews ?? [];
  });

  getCoverImage(): CoverImageDto {
    return {
      url: 'https://picsum.photos/seed/app-cover/800/400',
      alt: this.app.value()?.name ?? 'Application cover'
    };
  }

  private _buildMockFromSlug(slug: string): AppRecordDto {
    const name = slug
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    return {
      id: slug,
      slug,
      name,
      description: `${name} is a powerful application designed to streamline your workflow and boost productivity. With intuitive features and seamless integration, it helps teams collaborate more effectively.`,
      logo: 'https://picsum.photos/128',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: '0',
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }

  private _generateMockOverviewData() {
    return {
      category: { name: 'Productivity', slug: 'productivity', link: '/categories/productivity' },
      tags: [
        { name: 'workflow', slug: 'workflow', link: '/tags/workflow' },
        { name: 'collaboration', slug: 'collaboration', link: '/tags/collaboration' },
        { name: 'cloud', slug: 'cloud', link: '/tags/cloud' }
      ],
      aggregatedScore: 4.7,
      reviewsCount: 1234,
      healthStatus: {
        code: ApplicationHealthStatusCode.Operational,
        message: 'All Systems Operational'
      },
      latestReviews: [
        {
          authorName: 'Sarah Johnson',
          authorAvatarUrl: 'https://i.pravatar.cc/40?img=1',
          rating: 4.8,
          content: 'Excellent application with great features! Really transformed how our team works together.',
          date: 'Dec 24'
        },
        {
          authorName: 'Mike Thompson',
          authorAvatarUrl: 'https://i.pravatar.cc/40?img=2',
          rating: 4.5,
          content: 'Very useful for project management. The interface is intuitive and easy to navigate.',
          date: 'Dec 22'
        }
      ] as TopReview[],
      shortcuts: [
        { icon: '@tui.heart-pulse', title: 'Health Status', description: 'View system status and uptime', path: this.HEALTH_PATH, colorClass: 'health-icon' },
        { icon: '@tui.star', title: 'Reviews', description: 'Read user testimonials', path: this.REVIEWS_PATH, colorClass: 'reviews-icon' },
        { icon: '@tui.git-commit', title: 'Changelog', description: 'Recent updates and releases', path: this.DEVLOG_PATH, colorClass: 'timeline-icon' },
        { icon: '@tui.message-circle', title: 'Discussions', description: 'Join community conversations', path: this.DISCUSSIONS_PATH, colorClass: 'discussions-icon' }
      ]
    };
  }
}
