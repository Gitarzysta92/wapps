import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationTeaserFeedItem } from '@domains/feed';

export const APPLICATION_TEASER_FEED_ITEM_SELECTOR = 'application-teaser-feed-item';

@Component({
  selector: APPLICATION_TEASER_FEED_ITEM_SELECTOR,
  templateUrl: './application-teaser-feed-item.component.html',
  styleUrl: './application-teaser-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgForOf,
    RouterLink,
    RoutePathPipe
  ]
})
export class ApplicationTeaserFeedItemComponent implements IFeedItemComponent {
  @Input() ctaPath = "";
  @Input() item!: ApplicationTeaserFeedItem;

  getApplicationSlug(): string {
    return this.item.appSlug;
  }

  getApplicationOverviewLink(): string[] {
    return ['/app', this.getApplicationSlug(), 'overview'];
  }

  getApplicationName(): string {
    return this.item.appName;
  }

  getDescription(): string {
    return this.item.description;
  }

  getCategory(): string {
    return this.item.category;
  }

  getTags(): string[] {
    return this.item.tags;
  }

  getCoverImage(): CoverImageDto {
    return this.item.coverImage;
  }

  getAggregatedScore(): number {
    return this.item.aggregatedScore;
  }

  getReviewsCount(): number {
    return this.item.reviewsCount;
  }

  getCategoryLink(): string {
    return this.item.categoryLink;
  }

  getReviewsLink(): string {
    return this.item.reviewsLink;
  }
}

