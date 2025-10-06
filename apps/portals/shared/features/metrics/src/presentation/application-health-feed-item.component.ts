import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { IFeedItem, IFeedItemComponent } from '../models';

@Component({
  selector: 'application-health-feed-item',
  templateUrl: './application-health-feed-item.component.html',
  styleUrl: './application-health-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class ApplicationHealthFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem;

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
