import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ArticleHighlightFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, ElevatedCardComponent } from '@ui/layout';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';
import { UpvoteChipComponent } from '@ui/voting';
import { DiscussionChipComponent } from '@portals/shared/features/discussion';

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
    ElevatedCardComponent,
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
    RouterLink
  ],
  styles: [`
    .article-category {
      background-color: var(--tui-status-primary);
      color: white;
    }
    .article-content {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .article-excerpt {
      margin: 0;
      color: var(--tui-text-secondary);
      line-height: 1.6;
    }
    .cover-image {
      border-radius: 10px;
    }
  `],
  template: `
    <ui-elevated-card>
      <ui-cover-image
        class="cover-image"
        [image]="item.coverImage"
        slot="backdrop">
      </ui-cover-image>
      <share-toggle-button
        slot="actions"
        appearance="action-soft"
        size="s"
        type="articles"
        [slug]="item.id"
        [title]="item.title"
      />
      
      <div class="article-content">
        <tui-chip size="s" appearance="primary" class="article-category">
          <tui-icon icon="@tui.file-text" /> {{ item.category }}
        </tui-chip>
        
        <h3 uiMediumTitle>{{ item.title }}</h3>
        <p class="article-excerpt">{{ item.excerpt }}</p>
        
        <a
          tuiButton 
          size="s" 
          appearance="primary"
          [routerLink]="item.articleLink">
            <tui-icon icon="@tui.book-open-text"/>
            Read Article
        </a>
      </div>

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
    </ui-elevated-card>
  `,
})
export class ArticleHighlightFeedItemComponent {
  @Input() item!: ArticleHighlightFeedItemVM;
}
