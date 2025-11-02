import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ArticleHighlightFeedItem } from '@domains/feed';

export const ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR = 'article-highlight-feed-item';

export type ArticleHighlightFeedItemVM = Omit<ArticleHighlightFeedItem, never> & {
  articleLink: string;
}

@Component({
  selector: ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR,
  templateUrl: './article-highlight-feed-item.component.html',
  styleUrl: './article-highlight-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon
  ]
})
export class ArticleHighlightFeedItemComponent implements IFeedItemComponent {
  @Input() item!: ArticleHighlightFeedItem;

  getTitle(): string {
    return this.item.title;
  }

  getExcerpt(): string {
    return this.item.excerpt;
  }

  getAuthor(): string {
    return this.item.author;
  }

  getCategory(): string {
    return this.item.category;
  }

  getCoverImage(): CoverImageDto {
    return this.item.coverImage;
  }
}
