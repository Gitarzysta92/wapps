import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItem, IFeedItemComponent } from '../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { NgIf } from '@angular/common';


export const APPLICATION_HEALTH_FEED_ITEM_SELECTOR = 'application-health-feed-item';

@Component({
  selector: APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
  templateUrl: './application-health-feed-item.component.html',
  styleUrl: './application-health-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    NgIf
  ]
})
export class ApplicationHealthFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem & { title: string };

  getStatusIcon(): string {
    const status = this.item.metadata?.['status'];
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  }
}
