import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { NgForOf } from '@angular/common';
import type { DiscoverySearchResultArticleItemDto } from '@domains/discovery';
import { ElevatedCardComponent } from '@ui/layout';

export const ARTICLE_RESULT_TILE_SELECTOR = 'article-result-tile';

export type ArticleResultTileVM = Omit<DiscoverySearchResultArticleItemDto, 'tags'> & {
  tags: Array<DiscoverySearchResultArticleItemDto['tags'][0] & { link: string }>;
  articleLink: string;
  commentsLink: string;
  excerpt?: string;
}

@Component({
  selector: ARTICLE_RESULT_TILE_SELECTOR,
  templateUrl: './article-result-tile.component.html',
  styleUrl: './article-result-tile.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElevatedCardComponent,
    CoverImageComponent,
    TuiChip,
    TuiAvatar,
    NgForOf,
    
  ]
})
export class ArticleResultTileComponent {
  @Input() item!: ArticleResultTileVM;

  getTitle(): string {
    return this.item.title;
  }

  getSlug(): string {
    return this.item.slug;
  }

  getCoverImage(): CoverImageDto {
    return {
      url: this.item.coverImageUrl,
      alt: this.item.title
    };
  }

  getExcerpt(): string | null {
    // Excerpt is optional on VM
    return (this.item as unknown as { excerpt?: string })?.excerpt ?? null;
  }

  getCommentsNumber(): number {
    return this.item.commentsNumber;
  }

  getAuthorName(): string {
    return this.item.authorName;
  }

  getAuthorAvatarUrl(): string {
    return this.item.authorAvatarUrl;
  }

  getTags(): string[] {
    return this.item.tags.map(tag => tag.name);
  }

  getArticleLink(): string {
    return this.item.articleLink;
  }

  getCommentsLink(): string {
    return this.item.commentsLink;
  }
}

