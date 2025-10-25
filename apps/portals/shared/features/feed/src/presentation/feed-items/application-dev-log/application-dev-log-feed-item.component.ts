import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NgForOf } from '@angular/common';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationDevLogFeedItem } from '@domains/feed';
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
    RouterLink,
    RoutePathPipe
  ]
})
export class ApplicationDevLogFeedItemComponent implements IFeedItemComponent {
  @Input() ctaPath = "";
  @Input() item!: ApplicationDevLogFeedItem;

  getApplicationSlug(): string {
    return this.item.appSlug;
  }

  getApplicationName(): string {
    return this.item.appName;
  }

  getVersion(): string {
    return this.item.version;
  }

  getDescription(): string {
    return this.item.description;
  }

  getReleaseDate(): string {
    const date = this.item.releaseDate;
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
    return this.item.changes.map(change => change.description);
  }

  getChangeType(): 'major' | 'minor' | 'patch' {
    return this.item.changes[0].type as 'major' | 'minor' | 'patch';
  }

  getChangeTypeLabel(): string {
    const type = this.getChangeType();
    return type === 'major' ? 'Major Update' : type === 'minor' ? 'Minor Update' : 'Patch';
  }
}


