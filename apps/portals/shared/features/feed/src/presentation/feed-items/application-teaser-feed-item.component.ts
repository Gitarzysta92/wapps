import { QuickDiscussionButtonComponent } from '@portals/shared/features/discussion';
import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ElevatedCardComponent, MediumCardComponent, CardHeaderComponent } from '@ui/layout';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiButton } from '@taiga-ui/core';
import type { ApplicationTeaserFeedItemDto } from '@domains/feed';
import type { AddTypeToArray } from '@foundation/standard';
import {
  MediumTitleComponent,
} from '@ui/content';
import { TagsComponent } from '@ui/tags';
import {
  AppAvatarComponent,
  AppRatingComponent,
  AppCategoryChipComponent,
  AppReviewsChipComponent
} from '@portals/shared/features/application-overview';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { ContextMenuItem } from '@ui/context-menu-chip';
import { type AttributionInfoVM } from '@portals/shared/features/attribution';

export const APPLICATION_TEASER_FEED_ITEM_SELECTOR = 'application-teaser-feed-item';

export type ApplicationTeaserFeedItemVM = Omit<ApplicationTeaserFeedItemDto, 'category' | 'tags'> & {
  category: ApplicationTeaserFeedItemDto['category'] & { link: string };
  tags: AddTypeToArray<ApplicationTeaserFeedItemDto['tags'], { link: string }>;
  reviewsLink: string;
  appLink: string;
  contextMenu: ContextMenuItem[];
  attribution?: AttributionInfoVM;
}

@Component({
  selector: APPLICATION_TEASER_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    QuickDiscussionButtonComponent,
    ElevatedCardComponent,
    CoverImageComponent,
    TuiButton,
    RouterLink,
    MediumCardComponent,
    MediumTitleComponent,
    CardHeaderComponent,
    TagsComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppCategoryChipComponent,
    AppReviewsChipComponent,
    FavoriteToggleButtonComponent,
    FeedActionsMenuComponent,
    FeedAttributionComponent,
  ],
  styleUrl: './application-teaser-feed-item.component.scss',
  template: `
    <ui-elevated-card class="elevated-card">
      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage"
        slot="backdrop">
      </ui-cover-image>
      <ui-medium-card class="application-panel">
        <ui-card-header slot="header" class="card-header">
          <div class="application-avatar" slot="left-side">
            <app-avatar
              class="avatar-image"
              size="xl"
              role="img"
              [attr.aria-label]="item.appName"
              [avatar]="{ url: item.coverImage.url, alt: item.appName }"
            />
            <app-category-chip class="avatar-category" [category]="item.category" size="xs" />
          </div>
          <div class="application-title">
            <h3 uiMediumTitle class="application-name">{{ item.appName }}</h3>
            <app-rating [readonly]="true" [rating]="item.aggregatedScore"/>
          </div>
          <favorite-toggle-button slot="right-side" class="application-favorite"
            [iconOnly]="true" appearance="flat" type="applications" [slug]="item.appSlug" />
        </ui-card-header>

        <ui-tags [tags]="item.tags"></ui-tags>
        <p>{{ item.description }}</p>

        <app-reviews-chip slot="bottom-bar"
            [reviewsCount]="item.reviewsCount"
            [reviewsLink]="item.reviewsLink"
            size="xs"
            appearance="action-soft-flat"
          />
        @if (item.discussionSlug; as discussionSlug) {
          <discussion-quick-button slot="bottom-bar" [appSlug]="item.appSlug" [discussionSlug]="discussionSlug" />
        }
        @if (item.attribution) { <feed-attribution [title]="item.title" slot="bottom-bar-end" [attribution]="item.attribution" /> }

        <ng-template #cardActions let-iconOnly="iconOnly">
          <feed-actions-menu [iconOnly]="iconOnly"
            [contextMenu]="item.contextMenu"
            [title]="item.title"
          />
          <a tuiButton size="s" appearance="primary" iconStart="@tui.arrow-right" [routerLink]="item.appLink"
            [attr.aria-label]="'View application: ' + item.title">
            View application
          </a>
        </ng-template>
    </ui-medium-card>

    </ui-elevated-card>
  `,
})
export class ApplicationTeaserFeedItemComponent {
  @Input() item!: ApplicationTeaserFeedItemVM;
}
