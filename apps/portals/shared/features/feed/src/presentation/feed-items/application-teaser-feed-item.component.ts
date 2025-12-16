import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ElevatedCardComponent, MediumCardComponent, CardHeaderComponent, CardFooterComponent } from '@ui/layout';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ApplicationTeaserFeedItemDto } from '@domains/feed';
import { AddTypeToArray } from '@standard/utility-types';
import { 
  MediumTitleComponent,
} from '@ui/content';
import { TagsComponent } from '@ui/tags';
import { 
  AppAvatarComponent, 
  AppRatingComponent, 
  AppCategoryChipComponent,
  AppReviewsChipComponent 
} from '@portals/shared/features/app';
import { MyFavoriteToggleComponent } from '@portals/shared/features/my-favorites';
import { ContextMenuChipComponent, ContextMenuItem } from '@ui/context-menu-chip';

export const APPLICATION_TEASER_FEED_ITEM_SELECTOR = 'application-teaser-feed-item';

export type ApplicationTeaserFeedItemVM = Omit<ApplicationTeaserFeedItemDto, 'category' | 'tags'> & {
  category: ApplicationTeaserFeedItemDto['category'] & { link: string };
  tags: AddTypeToArray<ApplicationTeaserFeedItemDto['tags'], { link: string }>;
  reviewsLink: string;
  appLink: string;
  contextMenu: ContextMenuItem[];
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
    CardFooterComponent,
    TagsComponent,
    AppAvatarComponent,
    AppRatingComponent,
    AppCategoryChipComponent,
    AppReviewsChipComponent,
    MyFavoriteToggleComponent,
    ContextMenuChipComponent,
  ],
  styles: [
    `
      .medium-card, .card-footer, .favorite-toggle {
        background: var(--elevated-background);
        border-radius: 10px;
      }
      .card-footer {
        padding: 6px;
      }
      .cover-image {
        //filter: blur(5px);
      }
    `
  ],
  template: `
    <ui-elevated-card>
      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage"
        slot="backdrop">
      </ui-cover-image>
      <my-favorite-toggle
        class="favorite-toggle"
        slot="actions"
        [item]="item.appSlug"
        size="m"
      />
      <my-favorite-toggle
        class="favorite-toggle"
        slot="actions"
        [item]="item.appSlug"
        size="m"
      />
      <ui-medium-card class="medium-card">
        <app-category-chip 
          slot="top-edge"
          [category]="item.category"
        />
        <ui-card-header slot="header">
          <app-avatar 
            slot="left-side" 
            [size]="'xl'" 
            [avatar]="{ url: item.coverImage.url, alt: item.appName }"
          />
          <h3 uiMediumTitle>
            {{ item.appName }}
            <app-rating [readonly]="true" [rating]="item.aggregatedScore"/>
          </h3>
          <ui-tags [tags]="item.tags"></ui-tags>
        </ui-card-header>
        <p>{{ item.description }}</p>
        <a
          tuiButton 
          size="s" 
          appearance="primary"
          [routerLink]="item.appLink">
          <tui-icon icon="@tui.grid"/>
          Discover Application
        </a>
      </ui-medium-card>

      <ui-card-footer slot="footer" class="card-footer">
        <app-reviews-chip slot="right-side"
          [reviewsCount]="item.reviewsCount"
          [reviewsLink]="item.reviewsLink"
          size="xs"
          appearance="action-soft-flat"
        />
        <context-menu-chip
          slot="right-side"
          [contextMenu]="item.contextMenu"
          size="xs"
          appearance="action-soft-flat"
        />
      </ui-card-footer>

    </ui-elevated-card>
  `,
})
export class ApplicationTeaserFeedItemComponent {
  @Input() item!: ApplicationTeaserFeedItemVM;
}
