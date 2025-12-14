import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { CoverImageComponent } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ArticleHighlightFeedItem } from '@domains/feed';

export const ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR = 'article-highlight-feed-item';

export type ArticleHighlightFeedItemVM = Omit<ArticleHighlightFeedItem, never> & {
  articleLink: string;
}

@Component({
  selector: ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon
  ],
  template: `
    <content-feed-item
      icon="@tui.file-text"
      [item]="item">
      <div class="item-content" content>
        <ui-cover-image
          class="cover-image"
          [image]="item.coverImage">
        </ui-cover-image>
        <div class="article-info">
          <tui-chip 
            class="article-category" 
            appearance="primary">
            {{ item.category }}
          </tui-chip>
          <div class="article-content">
            <h3 class="article-title">{{ item.title }}</h3>
            <p class="article-excerpt"><b>{{ item.excerpt }}</b></p>
            <p class="article-excerpt">{{ item.excerpt }}</p>
          </div>
          <button
            class="article-cta" 
            tuiButton 
            size="s" 
            appearance="primary">
              <tui-icon icon="@tui.book-open-text"/>
              Read Article
          </button>
        </div>
      </div>
      <div class="item-actions" footer>
        <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.thumbs-up" />
            30
        </button>
         <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.messages-square" />
            126 Comments
        </button>
      </div>
    </content-feed-item>
  `,
  styles: [`
    .item-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .cover-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 8px;
    }

    .article-info {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .article-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .article-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .article-excerpt {
      margin: 0;
      color: var(--tui-text-secondary);
    }

    .item-actions {
      display: flex;
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--tui-border-normal);
    }

    .action-btn {
      flex: 1;
    }
  `]
})
export class ArticleHighlightFeedItemComponent {
  @Input() item!: ArticleHighlightFeedItemVM;
}
