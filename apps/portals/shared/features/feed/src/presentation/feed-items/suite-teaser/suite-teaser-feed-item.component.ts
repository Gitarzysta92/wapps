import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiChip, TuiAvatar } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf, NgIf } from '@angular/common';
import type { SuiteTeaserFeedItem, SuiteApp } from '@domains/feed';

export const SUITE_TEASER_FEED_ITEM_SELECTOR = 'suite-teaser-feed-item';

@Component({
  selector: SUITE_TEASER_FEED_ITEM_SELECTOR,
  templateUrl: './suite-teaser-feed-item.component.html',
  styleUrl: './suite-teaser-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    NgForOf,
    NgIf
  ]
})
export class SuiteTeaserFeedItemComponent implements IFeedItemComponent {
  @Input() item!: SuiteTeaserFeedItem;

  getSuiteTitle(): string {
    return this.item.suiteTitle;
  }

  getSuiteDescription(): string {
    return this.item.suiteDescription;
  }

  getApps(): SuiteApp[] {
    return this.item.apps;
  }

  getAppsCount(): number {
    return this.getApps().length;
  }

  getCategory(): string {
    return this.item.category;
  }
}

