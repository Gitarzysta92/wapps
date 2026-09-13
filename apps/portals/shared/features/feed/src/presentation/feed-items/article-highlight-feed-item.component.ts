import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import { FeedLocalVoteComponent } from '../actions/feed-local-vote.component';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ArticleHighlightFeedItem } from '@domains/feed';
import { CardHeaderComponent, MediumCardComponent } from '@ui/layout';
import { ExcerptComponent, MediumTitleComponent } from '@ui/content';
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
    TuiButton,
    TuiIcon,
    RouterLink,
    MediumCardComponent,
  ],
  styleUrl: './article-highlight-feed-item.component.scss',
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
            article <tui-icon icon="@tui.book-open-text" />
          </span>
        </h3>
        <article-details-badge class="article-details-badge" [article]="item" />
      </ui-card-header>

      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage">
      </ui-cover-image>

      <div class="article-summary">
        <h3 uiMediumTitle>{{ item.title }}</h3>
        <ui-tags [tags]="item.tags ?? []"></ui-tags>
        <ui-excerpt [excerpt]="item.excerpt" [maxLength]="200" />
      </div>
      <feed-local-vote slot="bottom-bar" [itemId]="item.id" [title]="item.title" [upvotes]="item.upvotesCount || 0" [allowDownvote]="false" />
      <span slot="bottom-bar">{{ item.commentsCount || 0 }} comments</span>
      @if (item.attribution) { <feed-attribution [title]="item.title" slot="bottom-bar" [attribution]="item.attribution" /> }

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
