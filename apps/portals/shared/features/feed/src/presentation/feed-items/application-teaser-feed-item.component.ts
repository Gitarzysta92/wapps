import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ElevatedCardComponent, MediumCardComponent, CardHeaderComponent } from '@ui/layout';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
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
    ElevatedCardComponent,
    CoverImageComponent,
    TuiButton,
    TuiIcon,
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
  styles: [
    `
      .medium-card {
        border-radius: 10px;
      }
      .medium-card, .card-footer {
        background: var(--elevated-background);
        border-radius: 10px;
      }
      .card-footer {
        padding: 0.2rem 0;
      }
      .cover-image {
        opacity: 0.3;
        /* filter: blur(5px); */
      }
    `
  ],
  template: `
    <ui-elevated-card class="elevated-card">
      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage"
        slot="backdrop">
      </ui-cover-image>
      <ui-medium-card class="medium-card">
        <app-category-chip
          slot="top-edge"
          [category]="item.category"
        />
        <ui-card-header slot="header" class="card-header">
          <app-avatar
            slot="left-side"
            [size]="'xl'"
            [avatar]="{ url: item.coverImage.url, alt: item.appName }"
          />
          <h3 uiMediumTitle>
            {{ item.appName }}
            <app-rating [readonly]="true" [rating]="item.aggregatedScore"/>
          </h3>
        </ui-card-header>

        <ui-tags [tags]="item.tags"></ui-tags>
        <p>{{ item.description }}</p>

        @if (item.attribution) { <feed-attribution [title]="item.title" slot="footer" [attribution]="item.attribution" /> }
        <app-reviews-chip slot="bottom-bar"
            [reviewsCount]="item.reviewsCount"
            [reviewsLink]="item.reviewsLink"
            size="xs"
            appearance="action-soft-flat"
          />

        <ng-template #cardActions>
          <favorite-toggle-button type="applications" [slug]="item.appSlug" />
          <a tuiButton size="s" appearance="primary" [routerLink]="item.appLink">
            <tui-icon icon="@tui.grid" />
            View application
          </a>
          <feed-actions-menu
            [contextMenu]="item.contextMenu"
            [title]="item.title"
            size="xs"
            appearance="action-soft-flat"
          />
        </ng-template>
    </ui-medium-card>

    </ui-elevated-card>
  `,
})
export class ApplicationTeaserFeedItemComponent {
  @Input() item!: ApplicationTeaserFeedItemVM;
}
