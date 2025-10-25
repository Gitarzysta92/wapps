import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe, DecimalPipe, NgFor, NgIf } from '@angular/common';
import { map, shareReplay } from 'rxjs';
import { TuiButton, TuiIcon, TuiLink } from '@taiga-ui/core';
import { TuiAvatar, TuiBadge, TuiChip } from '@taiga-ui/kit';
import { CoverImageComponent, CoverImageDto } from '@ui/cover-image';
import { StatusBannerComponent } from '@ui/status-banner';
import { AppRecordDto } from '@domains/catalog/record';
import { NAVIGATION } from '../../../navigation';

@Component({
  selector: 'app-application-overview-page',
  standalone: true,
  imports: [
    AsyncPipe,
    DecimalPipe,
    NgFor,
    NgIf,
    RouterLink,
    TuiButton,
    TuiIcon,
    TuiLink,
    TuiAvatar,
    TuiBadge,
    TuiChip,
    CoverImageComponent,
    StatusBannerComponent
  ],
  templateUrl: './application-overview-page.component.html',
  styleUrl: './application-overview-page.component.scss'
})
export class ApplicationOverviewPageComponent {
  private readonly _route = inject(ActivatedRoute);

  public readonly app$ = this._route.paramMap.pipe(
    map(p => p.get('appSlug') ?? 'unknown'),
    map(slug => this._buildMockFromSlug(slug)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  // Navigation paths
  readonly HEALTH_PATH = NAVIGATION.applicationHealth.path;
  readonly REVIEWS_PATH = NAVIGATION.applicationReviews.path;
  readonly TIMELINE_PATH = NAVIGATION.applicationTimeline.path;

  getCategory(): string {
    return 'Productivity';
  }

  getTags(): string[] {
    return ['workflow', 'collaboration', 'cloud'];
  }

  getCoverImage(): CoverImageDto {
    return {
      url: 'https://picsum.photos/seed/app/800/400',
      alt: 'Application cover'
    };
  }

  getAggregatedScore(): number {
    return 4.7;
  }

  getReviewsCount(): number {
    return 1234;
  }

  // Health status methods
  getHealthStatus(): 'operational' | 'degraded' | 'outage' {
    return 'operational';
  }

  getHealthStatusMessage(): string {
    return 'All Systems Operational';
  }

  getCurrentTimestamp(): Date {
    return new Date();
  }

  // Latest review methods
  getLatestReviewerName(): string {
    return 'Sarah Johnson';
  }

  getLatestReviewerRole(): string {
    return 'Product Manager';
  }

  getLatestTestimonial(): string {
    return 'Excellent application with great features!';
  }

  getLatestReviewDate(): string {
    return new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  getLatestRating(): number {
    return 4.8;
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
}
