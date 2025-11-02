import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { TuiAvatar } from '@taiga-ui/kit';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationReviewFeedItem } from '@domains/feed';

export const APPLICATION_REVIEW_FEED_ITEM_SELECTOR = 'application-review-feed-item';

export type ApplicationReviewFeedItemVM = Omit<ApplicationReviewFeedItem, never> & {
  appLink: string;
}

@Component({
  selector: APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
  templateUrl: './application-review-feed-item.component.html',
  styleUrl: './application-review-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    TuiButton,
    TuiIcon,
    NgForOf,
    TuiAvatar,
    RouterLink,
    RoutePathPipe
  ]
})
export class ApplicationReviewFeedItemComponent implements IFeedItemComponent {
  @Input() ctaPath = "";
  @Input() item!: ApplicationReviewFeedItem;

  getApplicationSlug(): string {
    return this.item.appSlug;
  }

  getApplicationReviewLink(): string[] {
    return ['/app', this.getApplicationSlug(), 'review'];
  }

  getRating(): number {
    return this.item.rating;
  }

  getReviewerName(): string {
    return this.item.reviewerName;
  }

  getReviewerAvatar(): string {
    return this.item.reviewerAvatar;
  }

  getReviewerRole(): string {
    return this.item.reviewerRole;
  }

  getTestimonial(): string {
    return this.item.testimonial;
  }

  getApplicationName(): string {
    return this.item.appName;
  }

  getReviewDate(): string {
    const date = this.item.reviewDate;
    if (date) {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    return new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  getHelpfulCount(): number {
    return this.item.helpfulCount;
  }
}

