import { Component, inject, computed, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { of, delay } from 'rxjs';
import { TuiButton, TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiBadge, TuiAvatar } from '@taiga-ui/kit';
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
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS } from '@portals/shared/data';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';
import { DiscussionStatsBadgeComponent } from '@portals/shared/features/discussion';

interface DiscussionTopic {
  id: string;
  title: string;
  author: string;
  authorAvatar: string;
  createdAt: Date;
  repliesCount: number;
  viewsCount: number;
  isPinned: boolean;
  tags: string[];
  excerpt: string;
  slug: string;
}

@Component({
  selector: 'app-application-discussions-page',
  standalone: true,
  imports: [
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiBadge,
    TuiAvatar,
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
    DiscussionStatsBadgeComponent
  ],
  templateUrl: './application-discussions-page.component.html',
  styleUrl: './application-discussions-page.component.scss',
})
export class ApplicationDiscussionsPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  private readonly _router = inject(Router);

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug) ?? this._buildMockFromSlug(appSlug ?? 'unknown');
      return of(app).pipe(delay(1000));
    }
  });

  public readonly discussions = rxResource({
    request: () => this.appSlug(),
    loader: () => of(this._generateMockDiscussions()).pipe(delay(1200))
  });

  public readonly totalStats = computed(() => {
    const discussionList = this.discussions.value() ?? [];
    return {
      topics: discussionList.length,
      totalReplies: discussionList.reduce((sum, d) => sum + d.repliesCount, 0),
      totalViews: discussionList.reduce((sum, d) => sum + d.viewsCount, 0)
    };
  });

  public readonly pinnedDiscussions = computed(() => {
    return (this.discussions.value() ?? []).filter(d => d.isPinned);
  });

  public readonly unpinnedDiscussions = computed(() => {
    return (this.discussions.value() ?? []).filter(d => !d.isPinned);
  });

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

  public formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  }

  public navigateToDiscussion(discussion: DiscussionTopic): void {
    const appSlug = this.appSlug();
    this._router.navigate(['/app', appSlug, 'topics', discussion.slug]);
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
      description: `${name} description`,
      logo: 'https://picsum.photos/128',
      isPwa: true,
      rating: 4.7,
      tagIds: [],
      categoryId: 0,
      platformIds: [],
      reviewNumber: 1234,
      updateDate: new Date(),
      listingDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    };
  }

  private _generateMockDiscussions(): DiscussionTopic[] {
    return [
      {
        id: '1',
        title: 'How to integrate with external APIs?',
        author: 'Sarah Chen',
        authorAvatar: 'https://i.pravatar.cc/40?img=1',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        repliesCount: 12,
        viewsCount: 156,
        isPinned: true,
        tags: ['integration', 'api', 'help'],
        excerpt: 'I\'m trying to integrate this app with our existing API infrastructure but running into authentication issues...',
        slug: 'how-to-integrate-with-external-apis'
      },
      {
        id: '2',
        title: 'Performance optimization tips',
        author: 'Mike Johnson',
        authorAvatar: 'https://i.pravatar.cc/40?img=2',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
        repliesCount: 8,
        viewsCount: 89,
        isPinned: false,
        tags: ['performance', 'optimization'],
        excerpt: 'After using this app for a few weeks, I\'ve discovered some great performance optimization techniques...',
        slug: 'performance-optimization-tips'
      },
      {
        id: '3',
        title: 'Feature request: Dark mode support',
        author: 'Emma Wilson',
        authorAvatar: 'https://i.pravatar.cc/40?img=3',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        repliesCount: 15,
        viewsCount: 234,
        isPinned: false,
        tags: ['feature-request', 'ui', 'dark-mode'],
        excerpt: 'Would love to see dark mode support added to the application. Many users have requested this feature...',
        slug: 'feature-request-dark-mode-support'
      },
      {
        id: '4',
        title: 'Bug report: Login issues on mobile',
        author: 'David Kim',
        authorAvatar: 'https://i.pravatar.cc/40?img=4',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        repliesCount: 6,
        viewsCount: 78,
        isPinned: false,
        tags: ['bug-report', 'mobile', 'login'],
        excerpt: 'Experiencing login failures on mobile devices. The authentication seems to work fine on desktop but fails on mobile browsers...',
        slug: 'bug-report-login-issues-on-mobile'
      },
      {
        id: '5',
        title: 'Best practices for team collaboration',
        author: 'Lisa Rodriguez',
        authorAvatar: 'https://i.pravatar.cc/40?img=5',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
        repliesCount: 23,
        viewsCount: 312,
        isPinned: true,
        tags: ['collaboration', 'best-practices', 'team'],
        excerpt: 'Sharing some tips and tricks we\'ve learned for effective team collaboration using this platform...',
        slug: 'best-practices-for-team-collaboration'
      }
    ];
  }
}
