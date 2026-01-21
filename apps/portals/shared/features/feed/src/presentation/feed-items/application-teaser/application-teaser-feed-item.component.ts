import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ElevatedCardComponent } from '@ui/layout';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationTeaserFeedItemDto } from '@domains/feed';
import { AddTypeToArray } from '@foundation/standard/utility-types';

export const APPLICATION_TEASER_FEED_ITEM_SELECTOR = 'application-teaser-feed-item';

export type ApplicationTeaserFeedItemVM = Omit<ApplicationTeaserFeedItemDto, 'category' | 'tags'> & {
  category: ApplicationTeaserFeedItemDto['category'] & { link: string };
  tags: AddTypeToArray<ApplicationTeaserFeedItemDto['tags'], { link: string }>;
  reviewsLink: string;
  appLink: string;
}

@Component({
  selector: APPLICATION_TEASER_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElevatedCardComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgForOf,
    RouterLink,
    RoutePathPipe,
    TuiAvatar,
    TuiIconPipe
  ],
  template: `
    <ui-elevated-card>
      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage"
        backdrop>
      </ui-cover-image>
      <div class="item-content" content>
        <div class="app-info">
          <tui-chip 
            class="app-category" 
            appearance="primary">
            {{ item.category.name }}
          </tui-chip>
          <div class="app-content">
            <tui-avatar 
              [src]="'@tui.mastercard' | tuiIcon"
              size="s"
            />
            <h3 class="app-name">{{ item.appName }}</h3>
            <p class="app-description">{{ item.description }}</p>
            <div class="app-tags">
              <tui-chip 
                *ngFor="let tag of item.tags"
                class="app-tag" 
                size="s"
                appearance="secondary">
                {{ tag.name }}
              </tui-chip>
            </div>
          </div>
          <a
            class="app-cta" 
            tuiButton 
            size="s" 
            appearance="primary"
            [routerLink]="item.appLink | routePath:{ appSlug: item.appSlug }">
              <tui-icon icon="@tui.grid"/>
              Application overview
          </a>
        </div>
      </div>
      <div class="item-actions" footer>
        <div class="score-container">
          Rating:
          <div class="score-stars">
            <tui-icon 
              *ngFor="let star of [1,2,3,4,5]"
              [icon]="star <= item.aggregatedScore ? '@tui.star' : '@tui.star'"
              [class.filled]="star <= item.aggregatedScore"
              class="star-icon" />
          </div>
          <span class="score-value">{{ item.aggregatedScore.toFixed(1) }}/5</span>
        </div>
        <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.message-circle" />
            See Reviews
            <span class="reviews-count">({{ item.reviewsCount }} reviews)</span>
        </button>
      </div>
    </ui-elevated-card>
  `,
  styles: [`
    .item-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .cover-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }

    .app-info {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .app-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .app-name {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .app-description {
      margin: 0;
      color: var(--tui-text-secondary);
    }

    .app-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .item-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-top: 1px solid var(--tui-border-normal);
    }

    .score-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .score-stars {
      display: flex;
      gap: 0.25rem;
    }

    .star-icon.filled {
      color: var(--tui-status-warning);
    }
  `]
})
export class ApplicationTeaserFeedItemComponent {
  @Input() item!: ApplicationTeaserFeedItemVM;
}
