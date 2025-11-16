import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { DiscoverySearchResultApplicationItemDto } from '@domains/discovery';
import { ContentFeedItemBlankComponent } from '@ui/content-feed';

export const APPLICATION_RESULT_TILE_SELECTOR = 'application-result-tile';

export type ApplicationResultTileVM = Omit<DiscoverySearchResultApplicationItemDto, 'category' | 'tags'> & {
  category: DiscoverySearchResultApplicationItemDto['category'] & { link: string };
  tags: Array<DiscoverySearchResultApplicationItemDto['tags'][0] & { link: string }>;
  applicationLink: string;
  reviewsLink: string;
}

@Component({
  selector: APPLICATION_RESULT_TILE_SELECTOR,
  templateUrl: './application-result-tile.component.html',
  styleUrl: './application-result-tile.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemBlankComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgForOf,
    RouterLink,
    RoutePathPipe,
    TuiIconPipe,
    TuiAvatar,
    TuiIconPipe,
  ]
})
export class ApplicationResultTileComponent {
  @Input() item!: ApplicationResultTileVM;

  getName(): string {
    return this.item.name;
  }

  getSlug(): string {
    return this.item.slug;
  }

  getCoverImage(): CoverImageDto {
    return {
      url: this.item.coverImageUrl,
      alt: this.item.name
    };
  }

  getRating(): number {
    return this.item.rating;
  }

  getCommentsNumber(): number {
    return this.item.commentsNumber;
  }

  getCategory(): string {
    return this.item.category.name;
  }

  getCategoryLink(): string {
    return this.item.category.link;
  }

  getTags(): string[] {
    return this.item.tags.map(tag => tag.name);
  }

  getApplicationLink(): string {
    return this.item.applicationLink;
  }

  getReviewsLink(): string {
    return this.item.reviewsLink;
  }
}

