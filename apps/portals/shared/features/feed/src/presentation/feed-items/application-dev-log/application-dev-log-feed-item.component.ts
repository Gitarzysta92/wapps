import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';

export const APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR = 'application-dev-log-feed-item';

@Component({
  selector: APPLICATION_DEV_LOG_FEED_ITEM_SELECTOR,
  templateUrl: './application-dev-log-feed-item.component.html',
  styleUrl: './application-dev-log-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    NgForOf,
    RouterLink
  ]
})
export class ApplicationDevLogFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getApplicationName(): string {
    return this.item.params?.['applicationName'] || 'Application';
  }

  getApplicationSlug(): string {
    return this.item.params?.['applicationSlug'] || this.item.params?.['applicationId'] || '1';
  }

  getApplicationLogLink(): string[] {
    return ['/app', this.getApplicationSlug(), 'log'];
  }

  getVersion(): string {
    return this.item.params?.['version'] || '1.0.0';
  }

  getDescription(): string {
    return this.item.params?.['description'] || 'New version released';
  }

  getReleaseDate(): string {
    const date = this.item.params?.['releaseDate'];
    if (date) {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    return new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  getChanges(): string[] {
    return this.item.params?.['changes'] || [];
  }

  getChangeType(): 'major' | 'minor' | 'patch' {
    return this.item.params?.['changeType'] || 'minor';
  }

  getChangeTypeLabel(): string {
    const type = this.getChangeType();
    return type === 'major' ? 'Major Update' : type === 'minor' ? 'Minor Update' : 'Patch';
  }
}


