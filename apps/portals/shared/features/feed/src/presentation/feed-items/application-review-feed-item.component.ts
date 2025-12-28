import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationReviewFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent, AppRatingComponent } from '@portals/shared/features/application-overview';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';
import { UpvoteChipComponent, DownvoteChipComponent } from '@ui/voting';
import { VotingContainerDirective, type VotingData } from '@portals/shared/features/voting';
import { ReviewAuthorBadgeComponent, ReviewQuoteShortComponent } from '@portals/shared/features/review';
import { ProfileBadgesComponent } from '@portals/shared/features/user-profile';

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
    ReviewAuthorBadgeComponent,
    ReviewQuoteShortComponent,
    ProfileBadgesComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    RouterLink,
    RoutePathPipe
  ],
  styles: [`
    .review-label {
      display: inline-flex;
      align-items: center;
      opacity: 0.5;
      margin-left: 0.5rem;
    }
    .review-quote-short {
      margin: 1rem 0;
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
            review <tui-icon [style.height]="'14px'" icon="@tui.star" /> 
          </span>
        </h3>
        <review-author-badge
          [reviewerName]="item.reviewerName"
          [reviewDate]="item.reviewDate">
          <profile-badges slot='badges' [badges]="item.reviewerBadges"></profile-badges>
        </review-author-badge>
        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="applications"
          [slug]="item.appSlug"
          [title]="item.appName"
        />
      </ui-card-header>

      <review-quote-short class="review-quote-short" [quote]="item.testimonial">
        <app-rating [readonly]="true" [rating]="item.rating"/>
      </review-quote-short>

      <a
        tuiButton 
        size="s" 
        appearance="primary"
        [routerLink]="ctaPath | routePath:{ appSlug: item.appSlug }">
          <tui-icon icon="@tui.external-link"/>
          Read review
      </a>

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
