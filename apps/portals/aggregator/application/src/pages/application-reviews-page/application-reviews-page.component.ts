import { RouterLink } from '@angular/router';
import { Component, inject, computed, input, signal, effect } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { TuiButton, TuiIcon, TuiAppearance } from '@taiga-ui/core';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { AppRecordDto } from '@domains/catalog/record';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import { 
  PageHeaderComponent, 
  PageTitleComponent, 
  PageTitleSkeletonComponent,
  PageMetaComponent,
  PageMetaSkeletonComponent,
  MediumCardComponent,
  MediumCardSkeletonComponent,
  ContentStateComponent
} from '@ui/layout';
import { IBreadcrumbRouteData, NavigationDeclarationDto, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { APPLICATIONS } from '@portals/shared/data';
import { NAVIGATION_NAME_PARAMS } from '../../navigation';
import { AppRatingComponent, LOCAL_APPLICATION_DATA } from '@portals/shared/features/application-overview';

interface ReviewData {
  id: string;
  authorName: string;
  authorAvatarUrl: string;
  authorRole: string;
  authorBadges: { type: string; label: string }[];
  rating: number;
  content: string;
  date: string;
  helpfulCount: number;
  isVerified: boolean;
}

@Component({
  selector: 'app-application-reviews-page',
  standalone: true,
  imports: [
    RouterLink,
    ContentStateComponent,
    CommonModule,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    TuiChip,
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
    AppRatingComponent
  ],
  templateUrl: './application-reviews-page.component.html',
  styleUrl: './application-reviews-page.component.scss'
})
export class ApplicationReviewsPageComponent implements 
  routingDataConsumerFrom<IBreadcrumbRouteData & { appSlug: string | null }> {

  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);
  public readonly appSlug = input<string | null>(null);

  readonly localMode = inject(LOCAL_APPLICATION_DATA);
  readonly visibleCount = signal(3);
  readonly helpfulIds = signal<string[]>([]);
  readonly actionError = signal('');
  readonly helpfulLoaded = signal(false);
  constructor() {
    effect(() => {
      const slug = this.appSlug();
      this.visibleCount.set(3);
      this.actionError.set('');
      this.helpfulLoaded.set(false);
      this.helpfulIds.set([]);
      if (!this.localMode || !slug) return;
      try {
        const saved: unknown = JSON.parse(localStorage.getItem('wapps.review-helpful.' + slug) ?? '[]');
        if (!Array.isArray(saved) || saved.some(id => typeof id !== 'string')) throw new Error('Invalid saved marks');
        this.helpfulIds.set([...new Set(saved)]);
        this.helpfulLoaded.set(true);
      } catch { this.actionError.set('Could not load your helpful marks from this browser. Reload the page to retry.'); }
    });
  }
  toggleHelpful(id: string) {
    if (!this.localMode || !this.helpfulLoaded() || !this.app.value() || !this.reviewsData.value()?.reviews.some(review => review.id === id)) return;
    const next = this.helpfulIds().includes(id) ? this.helpfulIds().filter(value => value !== id) : [...this.helpfulIds(), id];
    try {
      localStorage.setItem('wapps.review-helpful.' + this.appSlug(), JSON.stringify(next));
      this.helpfulIds.set(next);
      this.actionError.set('');
    } catch { this.actionError.set('Could not save your helpful mark in this browser.'); }
  }
  loadMore() { this.visibleCount.update(count => count + 3); }
  readonly hasMoreReviews = computed(() => this.visibleCount() < (this.reviewsData.value()?.reviews.length ?? 0));

  public readonly app = rxResource({
    request: () => this.appSlug(),
    loader: ({ request: appSlug }) => {
      const app = APPLICATIONS.find(a => a.slug === appSlug) ?? null;
      return of(app);
    }
  });

  public readonly reviewsData = rxResource({
    request: () => this.appSlug(),
    loader: () => of(this._generateMockReviewsData())
  });

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

  public readonly ratingStats = computed(() => {
    const data = this.reviewsData.value();
    if (!data?.reviews.length) return null;
    
    const totalReviews = data.reviews.length;
    const avgRating = data.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    
    const distribution = [0, 0, 0, 0, 0];
    data.reviews.forEach(r => {
      const index = Math.floor(r.rating) - 1;
      if (index >= 0 && index < 5) distribution[index]++;
    });
    
    return {
      average: avgRating,
      total: totalReviews,
      distribution: distribution.map((count, index) => ({
        stars: index + 1,
        count,
        percentage: (count / totalReviews) * 100
      })).reverse()
    };
  });

  public readonly reviews = computed(() => {
    return (this.reviewsData.value()?.reviews ?? []).slice(0, this.visibleCount());
  });

  getRatingStars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  private _generateMockReviewsData() {
    return {
      reviews: [
        {
          id: '1',
          authorName: 'Sarah Johnson',
          authorAvatarUrl: 'https://i.pravatar.cc/80?img=1',
          authorRole: 'Product Manager',
          authorBadges: [{ type: 'verified', label: 'Verified Purchase' }],
          rating: 5,
          content: 'This application has completely transformed how our team collaborates. The interface is intuitive, the features are powerful, and the support team is incredibly responsive. Highly recommend for any team looking to boost productivity!',
          date: 'Dec 24, 2024',
          helpfulCount: 42,
          isVerified: true
        },
        {
          id: '2',
          authorName: 'Mike Thompson',
          authorAvatarUrl: 'https://i.pravatar.cc/80?img=2',
          authorRole: 'Senior Engineer',
          authorBadges: [{ type: 'top-reviewer', label: 'Top Reviewer' }],
          rating: 4,
          content: 'Very solid application with great potential. The core features work flawlessly and the recent updates have addressed most of my initial concerns. Would love to see more customization options in future releases.',
          date: 'Dec 22, 2024',
          helpfulCount: 28,
          isVerified: true
        },
        {
          id: '3',
          authorName: 'Emily Chen',
          authorAvatarUrl: 'https://i.pravatar.cc/80?img=3',
          authorRole: 'Designer',
          authorBadges: [],
          rating: 5,
          content: 'Beautiful design and excellent user experience. As a designer, I appreciate the attention to detail in the UI. Everything feels polished and professional.',
          date: 'Dec 20, 2024',
          helpfulCount: 15,
          isVerified: false
        },
        {
          id: '4',
          authorName: 'David Kim',
          authorAvatarUrl: 'https://i.pravatar.cc/80?img=4',
          authorRole: 'Team Lead',
          authorBadges: [{ type: 'verified', label: 'Verified Purchase' }],
          rating: 4,
          content: 'Good overall experience. Integration with our existing tools was seamless. Documentation could be more comprehensive, but the product itself is solid.',
          date: 'Dec 18, 2024',
          helpfulCount: 11,
          isVerified: true
        },
        {
          id: '5',
          authorName: 'Lisa Rodriguez',
          authorAvatarUrl: 'https://i.pravatar.cc/80?img=5',
          authorRole: 'Freelancer',
          authorBadges: [],
          rating: 5,
          content: 'Exactly what I needed for my workflow. Simple yet powerful. The pricing is fair and the value is exceptional.',
          date: 'Dec 15, 2024',
          helpfulCount: 8,
          isVerified: true
        }
      ] as ReviewData[]
    };
  }
}
