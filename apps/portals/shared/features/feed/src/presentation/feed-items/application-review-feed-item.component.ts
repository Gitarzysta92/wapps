import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgFor } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationReviewFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent, AppRatingComponent } from '@portals/shared/features/app';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';
import { UpvoteChipComponent, DownvoteChipComponent } from '@ui/voting';
import { VotingContainerDirective, type VotingData } from '@portals/shared/features/voting';

export const APPLICATION_REVIEW_FEED_ITEM_SELECTOR = 'application-review-feed-item';

export type ApplicationReviewFeedItemVM = Omit<ApplicationReviewFeedItem, never> & {
  appLink: string;
  contextMenu: ContextMenuItem[];
  voting: VotingData;
  attribution?: AttributionInfoVM;
}

@Component({
  selector: APPLICATION_REVIEW_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MediumCardComponent,
    CardHeaderComponent,
    CardFooterComponent,
    MediumTitleComponent,
    AppAvatarComponent,
    AppRatingComponent,
    ShareToggleButtonComponent,
    ContextMenuChipComponent,
    AttributionInfoBadgeComponent,
    UpvoteChipComponent,
    DownvoteChipComponent,
    VotingContainerDirective,
    TuiAvatar,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgFor,
    RouterLink,
    RoutePathPipe
  ],
  styles: [`
    .review-chip {
      background-color: var(--tui-status-warning);
      color: white;
    }
    .review-label {
      display: inline-flex;
      align-items: center;
      opacity: 0.5;
      margin-left: 0.5rem;
    }
    .review-content {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 2rem;
      padding: 1rem 0;
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
    .testimonial {
      margin: 0;
      font-style: italic;
      color: var(--tui-text-secondary);
      padding: 1rem;
      background: var(--tui-background-neutral-1);
      border-radius: 8px;
      border-left: 4px solid var(--tui-status-warning);
    }
  `],
  template: `
    <ui-medium-card class="medium-card">
      <ui-card-header slot="header">
        <app-avatar
          slot="left-side"
          [size]="'m'"
          [avatar]="{ url: 'https://picsum.photos/200', alt: item.appName }"/>
        <h3 uiMediumTitle>
          {{ item.appName }}
          <span class="review-label">
            <tui-icon icon="@tui.message-square" /> Review
          </span>
        </h3>
        <app-rating [readonly]="true" [rating]="item.rating"/>
        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="applications"
          [slug]="item.appSlug"
          [title]="item.appName"
        />
      </ui-card-header>
      
      <div class="review-content">
        <div class="reviewer-column">
          <tui-avatar src="AI" size="l" />
          <div class="reviewer-name">{{ item.reviewerName }}</div>
          <div class="reviewer-meta">
            <span class="reviewer-role">{{ item.reviewerRole }}</span>
            <span class="review-date">{{ item.reviewDate }}</span>
          </div>
        </div>

        <div class="review-column">
          <p class="testimonial">"{{ item.testimonial }}"</p>
          <a
            tuiButton 
            size="s" 
            appearance="primary"
            [routerLink]="ctaPath | routePath:{ appSlug: item.appSlug }">
              <tui-icon icon="@tui.external-link"/>
              Read Full Review
          </a>
        </div>
      </div>

      <ui-card-footer slot="footer">
        <attribution-info-badge slot="left-side" [attribution]="item.attribution" />
        <div
          slot="right-side"
          #votingContainer="votingContainer"
          [votingContainer]="item.voting">
          <upvote-chip
            [count]="votingContainer.upvotesCount()"
            size="xs"
            appearance="action-soft-flat"
            (click)="votingContainer.upvote()"
          />
          <downvote-chip
            [count]="votingContainer.downvotesCount()"
            size="xs"
            appearance="action-soft-flat"
            (click)="votingContainer.downvote()"
          />
        </div>
        <context-menu-chip
          slot="right-side"
          [contextMenu]="item.contextMenu"
          size="xs"
          appearance="action-soft-flat"
        />
      </ui-card-footer>
    </ui-medium-card>
  `,
})
export class ApplicationReviewFeedItemComponent {
  @Input() item!: ApplicationReviewFeedItemVM;
  @Input() ctaPath = '';
}
