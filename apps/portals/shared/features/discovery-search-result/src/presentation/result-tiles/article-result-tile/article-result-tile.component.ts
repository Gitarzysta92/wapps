import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { DiscoverySearchResultArticleItemDto } from '@domains/discovery';
import { ContentFeedItemBlankComponent } from '@ui/content-feed';

export const ARTICLE_RESULT_TILE_SELECTOR = 'article-result-tile';

export type ArticleResultTileVM = Omit<DiscoverySearchResultArticleItemDto, 'tags'> & {
  tags: Array<DiscoverySearchResultArticleItemDto['tags'][0] & { link: string }>;
  articleLink: string;
  commentsLink: string;
}

@Component({
  selector: ARTICLE_RESULT_TILE_SELECTOR,
  templateUrl: './article-result-tile.component.html',
  styleUrl: './article-result-tile.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemBlankComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    NgForOf,
    RouterLink,
    RoutePathPipe
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

