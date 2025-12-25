import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ArticleHighlightFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, ElevatedCardComponent, MediumCardComponent } from '@ui/layout';
import { ExcerptComponent, FadeOutExcerptComponent, MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';
import { UpvoteChipComponent } from '@ui/voting';
import { DiscussionChipComponent } from '@portals/shared/features/discussion';
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
    AppAvatarComponent,
    ArticleDetailsBadgeComponent,
    ExcerptComponent,
    TagsComponent,
    CardHeaderComponent,
    CardFooterComponent,
    MediumTitleComponent,
    CoverImageComponent,
    ShareToggleButtonComponent,
    ContextMenuChipComponent,
    AttributionInfoBadgeComponent,
    UpvoteChipComponent,
    DiscussionChipComponent,
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
        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="applications"
          [slug]="item.id"
          [title]="item.title"
        />
        <button
          tuiButton
          appearance="action-soft"
          size="s"
          slot="right-side"
        >
          <tui-icon icon="@tui.circle-arrow-right" />
        </button>
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
      
      <a
        tuiButton 
        size="s" 
        appearance="primary"
        [routerLink]="item.articleLink">
          <tui-icon icon="@tui.book-open-text"/>
          Read Article
      </a>
      <ui-card-footer slot="footer">
        <attribution-info-badge slot="left-side" [attribution]="item.attribution" />
        <upvote-chip
          slot="right-side"
          [count]="item.upvotesCount"
          size="xs"
          appearance="action-soft-flat"
        />
        <discussion-chip
          slot="right-side"
          [commentsCount]="item.commentsCount"
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
    </ui-medium-card>

    <!-- <ui-elevated-card>

      <share-toggle-button
        slot="actions"
        appearance="action-soft"
        size="s"
        type="articles"
        [slug]="item.id"
        [title]="item.title"
      />
    
      
    </ui-elevated-card> -->
  `,
})
export class ArticleHighlightFeedItemComponent {
  @Input() item!: ArticleHighlightFeedItemVM;
}
