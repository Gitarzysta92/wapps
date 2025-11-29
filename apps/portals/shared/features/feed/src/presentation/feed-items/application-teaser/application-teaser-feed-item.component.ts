import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';
import { TuiAvatar, TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationTeaserFeedItemDto } from '@domains/feed';
import { ElevatedCardComponent } from '@ui/layout';
import { AddTypeToArray } from '@standard/utility-types';

export const APPLICATION_TEASER_FEED_ITEM_SELECTOR = 'application-teaser-feed-item';

export type ApplicationTeaserFeedItemVM = Omit<ApplicationTeaserFeedItemDto, 'category' | 'tags'> & {
  category: ApplicationTeaserFeedItemDto['category'] & { link: string };
  tags: AddTypeToArray<ApplicationTeaserFeedItemDto['tags'], { link: string }>;
  reviewsLink: string;
  appLink: string;
}

@Component({
  selector: APPLICATION_TEASER_FEED_ITEM_SELECTOR,
  templateUrl: './application-teaser-feed-item.component.html',
  styleUrl: './application-teaser-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElevatedCardComponent,
    CoverImageComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgForOf,
    RouterLink,
    RoutePathPipe,
    TuiAvatar,
    TuiIcon,
    TuiIconPipe
  ]
})
export class ApplicationTeaserFeedItemComponent implements IFeedItemComponent {

  @Input() item!: ApplicationTeaserFeedItemVM;

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
    return this.item.category.name;
  }

  getTags(): string[] {
    return this.item.tags.map(tag => tag.name);
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
    return this.item.category.link;
  }

  getReviewsLink(): string {
    return this.item.reviewsLink;
  }
}

