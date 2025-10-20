import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';

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
    NgForOf
  ]
})
export class ApplicationTeaserFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getApplicationName(): string {
    return this.item.params?.['applicationName'] || 'Application Name';
  }

  getDescription(): string {
    return this.item.params?.['description'] || 'Discover this amazing application...';
  }

  getCategory(): string {
    return this.item.params?.['category'] || 'General';
  }

  getTags(): string[] {
    return this.item.params?.['tags'] || [];
  }

  getCoverImage(): CoverImageDto {
    return this.item.params?.['coverImage'];
  }

  getAggregatedScore(): number {
    return this.item.params?.['aggregatedScore'] || 0;
  }

  getReviewsCount(): number {
    return this.item.params?.['reviewsCount'] || 0;
  }

  getCategoryLink(): string {
    return this.item.params?.['categoryLink'] || '#';
  }

  getReviewsLink(): string {
    return this.item.params?.['reviewsLink'] || '#';
  }
}

