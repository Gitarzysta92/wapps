import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { map, shareReplay } from 'rxjs';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { AppRecordDto } from '@domains/catalog/record';

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
    AsyncPipe,
    NgFor,
    NgIf,
    TuiButton,
    TuiIcon,
    TuiBadge
  ],
  templateUrl: './application-discussions-page.component.html',
  styleUrl: './application-discussions-page.component.scss',
})
export class ApplicationDiscussionsPageComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  public readonly app$ = this._route.paramMap.pipe(
    map(p => p.get('appSlug') ?? 'unknown'),
    map(slug => this._buildMockFromSlug(slug)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  public readonly discussions$ = this.app$.pipe(
    map(() => this._generateMockDiscussions())
  );

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
      logo: 'https://static.store.app/cdn-cgi/image/width=128,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png',
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
      },
      {
        id: '6',
        title: 'Integration with Slack workspace',
        author: 'Alex Thompson',
        authorAvatar: 'https://i.pravatar.cc/40?img=6',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96),
        repliesCount: 9,
        viewsCount: 145,
        isPinned: false,
        tags: ['integration', 'slack', 'workspace'],
        excerpt: 'Has anyone successfully integrated this app with their Slack workspace? Looking for guidance on the setup process...',
        slug: 'integration-with-slack-workspace'
      }
    ];
  }

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
    const appSlug = this._route.snapshot.paramMap.get('appSlug');
    this._router.navigate(['/app', appSlug, 'topics', discussion.slug]);
  }
}
