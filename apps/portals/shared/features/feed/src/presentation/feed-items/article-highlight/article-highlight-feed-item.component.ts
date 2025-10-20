import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

export const ARTICLE_HIGHLIGHT_FEED_ITEM_SELECTOR = 'article-highlight-feed-item';

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
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getTitle(): string {
    return this.item.params?.['title'] || 'Featured Article';
  }

  getExcerpt(): string {
    return this.item.params?.['excerpt'] || 'Check out this interesting article...';
  }

  getAuthor(): string {
    return this.item.params?.['author'] || 'Editorial Team';
  }

  getCategory(): string {
    return this.item.params?.['category'] || 'General';
  }

  getCoverImage(): CoverImageDto {
    return this.item.params?.['coverImage'];
  }
}
