import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiAvatar } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationReviewFeedItem } from '@domains/feed';

export const APPLICATION_REVIEW_FEED_ITEM_SELECTOR = 'application-review-feed-item';

export type ApplicationReviewFeedItemVM = Omit<ApplicationReviewFeedItem, never> & {
  appLink: string;
}

@Component({
  selector: APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    TuiAvatar,
    TuiButton,
    TuiIcon,
    NgFor,
    RouterLink,
    RoutePathPipe
  ],
  template: `
    <content-feed-item
      icon="@tui.star"
      [item]="item">
      <div class="item-content" content>
        <div class="reviewer-column">
          <tui-avatar src="AI" />
          <div class="reviewer-name">{{ item.reviewerName }}</div>
          <div class="reviewer-meta">
            <span class="reviewer-role">{{ item.reviewerRole }}</span>
            <span class="review-date">{{ item.reviewDate }}</span>
          </div>
        </div>

        <div class="review-column">
          <h3 class="application-name">{{ item.appName }}</h3>
          <p class="testimonial">"{{ item.testimonial }}"</p>

          <div class="rating-container">
            <span class="rating-value">{{ item.rating.toFixed(1) }}/5</span>
            <div class="rating-stars">
              <tui-icon 
                *ngFor="let star of [1,2,3,4,5]"
                [icon]="star <= item.rating ? '@tui.star' : '@tui.star'"
                [class.filled]="star <= item.rating"
                class="star-icon" />
            </div>
          </div>

          <a
            class="review-cta" 
            tuiButton 
            size="s" 
            appearance="primary"
            [routerLink]="ctaPath | routePath:{ appSlug: item.appSlug }">
              <tui-icon icon="@tui.external-link"/>
              Read Full Review
          </a>
        </div>
      </div>
    </content-feed-item>
  `,
  styles: [`
    .item-content {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 2rem;
      padding: 1rem;
    }

    .reviewer-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      text-align: center;
    }

    .reviewer-name {
      font-weight: 600;
    }

    .reviewer-meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: var(--tui-text-secondary);
    }

    .review-column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .application-name {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .testimonial {
      margin: 0;
      font-style: italic;
      color: var(--tui-text-secondary);
    }

    .rating-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .rating-stars {
      display: flex;
      gap: 0.25rem;
    }

    .star-icon.filled {
      color: var(--tui-status-warning);
    }
  `]
})
export class ApplicationReviewFeedItemComponent {
  @Input() item!: ApplicationReviewFeedItemVM;
  @Input() ctaPath = '';
}
