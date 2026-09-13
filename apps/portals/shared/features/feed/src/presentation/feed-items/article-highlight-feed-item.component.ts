import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { FeedLocalVoteComponent } from '../actions/feed-local-vote.component';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ArticleHighlightFeedItem } from '@domains/feed';
import { CardHeaderComponent, ElevatedCardComponent, MediumCardComponent } from '@ui/layout';
import { ExcerptComponent, FadeOutExcerptComponent, MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { type ContextMenuItem } from '@ui/context-menu-chip';
import { type AttributionInfoVM } from '@portals/shared/features/attribution';
import { AppAvatarComponent } from '@portals/shared/features/application-overview';
import { TagsComponent } from '@ui/tags';
import { ArticleDetailsBadgeComponent } from '@portals/shared/features/articles';

export const ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR = 'article-highlight-feed-item';

export type ArticleHighlightFeedItemVM = Omit<ArticleHighlightFeedItem, never> & {
  articleLink: string;
  contextMenu: ContextMenuItem[];
  upvotesCount: number;
  commentsCount: number;
  attribution?: AttributionInfoVM;
}

@Component({
  selector: ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FavoriteToggleButtonComponent,
    FeedLocalVoteComponent,
    AppAvatarComponent,
    ArticleDetailsBadgeComponent,
    ExcerptComponent,
    TagsComponent,
    CardHeaderComponent,
    MediumTitleComponent,
    CoverImageComponent,
    ShareToggleButtonComponent,
    FeedActionsMenuComponent,
    FeedAttributionComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    RouterLink,
    MediumCardComponent,
  ],
  styles: [`
    .cover-image {
      margin-top: 1rem;
      height: 150px;
      color: var(--tui-text-secondary);
      border-radius: 10px;
      mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
      -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
      -webkit-mask-size: 100% 100%;
      -webkit-mask-position: 0 0;
      -webkit-mask-repeat: no-repeat;
      mask-size: 100% 100%;
      mask-position: 0 0;
      mask-repeat: no-repeat;
    }

    .article-label {
      display: inline-flex;
      align-items: center;
      opacity: 0.5;
      margin-left: 0.5rem;
    }

    .article-details {
      margin-top: -50px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .article-details-badge {
     opacity: 0.5;
    }

  `],
  template: `
    <ui-medium-card>
      <ui-card-header slot="header">
        <app-avatar
          slot="left-side"
          [size]="'m'"
          [avatar]="{ url: 'https://picsum.photos/200', alt: item.title }"/>
        <h3 uiMediumTitle>
          {{ item.author }}
          <span class="article-label">
            article <tui-icon [style.height]="'16px'" icon="@tui.book-open-text" />
          </span>
        </h3>
        <article-details-badge class="article-details-badge" [article]="item" />
      </ui-card-header>

      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage"
        slot="backdrop">
      </ui-cover-image>

      <div class="article-details">
        <h3 uiMediumTitle>{{ item.title }}</h3>
        <ui-tags [tags]="item.tags ?? []"></ui-tags>
        <ui-excerpt [excerpt]="item.excerpt" [maxLength]="200" />
      </div>
      @if (item.attribution) { <feed-attribution [title]="item.title" slot="footer" [attribution]="item.attribution" /> }
      <feed-local-vote slot="bottom-bar" [itemId]="item.id" [title]="item.title" [upvotes]="item.upvotesCount || 0" [allowDownvote]="false" />
      <span slot="bottom-bar">{{ item.commentsCount || 0 }} comments</span>

      <ng-template #cardActions>
        <favorite-toggle-button type="articles" [slug]="articleSlug" />
        <share-toggle-button
          appearance="action-soft"
          size="s"
          type="articles"
          [slug]="articleSlug"
          [path]="item.articleLink"
          [title]="item.title"
        />
        <a
          tuiButton
          appearance="primary"
          size="s"
          [routerLink]="item.articleLink"
          [attr.aria-label]="'Read article: ' + item.title"
          ><tui-icon icon="@tui.circle-arrow-right" aria-hidden="true" />Read article</a
        >
        <feed-actions-menu
          [contextMenu]="item.contextMenu"
          [title]="item.title"
          size="xs"
          appearance="action-soft-flat"
        />
      </ng-template>
    </ui-medium-card>
  `,
})
export class ArticleHighlightFeedItemComponent {
  @Input() item!: ArticleHighlightFeedItemVM;
  get articleSlug(): string { return this.item.articleLink?.split(/[?#]/)[0].split('/').filter(Boolean).pop() || this.item.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); }
}
