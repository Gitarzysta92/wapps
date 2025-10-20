import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiChip, TuiAvatar } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf, NgIf } from '@angular/common';

export const SUITE_TEASER_FEED_ITEM_SELECTOR = 'suite-teaser-feed-item';

export interface SuiteApp {
  name: string;
  logo?: string;
  description?: string;
}

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
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getSuiteTitle(): string {
    return this.item.params?.['suiteTitle'] || 'Application Suite';
  }

  getSuiteDescription(): string {
    return this.item.params?.['suiteDescription'] || 'Discover our collection of applications';
  }

  getApps(): SuiteApp[] {
    return this.item.params?.['apps'] || [];
  }

  getAppsCount(): number {
    return this.getApps().length;
  }

  getCategory(): string {
    return this.item.params?.['category'] || 'Suite';
  }
}

