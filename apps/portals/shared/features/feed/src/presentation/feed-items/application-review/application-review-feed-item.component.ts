import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { TuiAvatar } from '@taiga-ui/kit';

export const APPLICATION_REVIEW_FEED_ITEM_SELECTOR = 'application-review-feed-item';

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
    RouterLink
  ]
})
export class ApplicationReviewFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getApplicationSlug(): string {
    return this.item.params?.['applicationSlug'] || this.item.params?.['applicationId'] || '1';
  }

  getApplicationReviewLink(): string[] {
    return ['/app', this.getApplicationSlug(), 'review'];
  }

  getRating(): number {
    return this.item.params?.['rating'] || 0;
  }

  getReviewerName(): string {
    return this.item.params?.['reviewerName'] || 'Anonymous';
  }

  getReviewerAvatar(): string {
    return this.item.params?.['reviewerAvatar'] || '';
  }

  getReviewerRole(): string {
    return this.item.params?.['reviewerRole'] || 'User';
  }

  getTestimonial(): string {
    return this.item.params?.['testimonial'] || 'Great application!';
  }

  getApplicationName(): string {
    return this.item.params?.['applicationName'] || 'Application';
  }

  getReviewDate(): string {
    const date = this.item.params?.['reviewDate'];
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
    return this.item.params?.['helpfulCount'] || 0;
  }
}

