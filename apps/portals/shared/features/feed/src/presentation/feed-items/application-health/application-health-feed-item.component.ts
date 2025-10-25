import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { StatusBannerComponent } from '@ui/status-banner';
import { ServiceStatusItemComponent, ServiceStatus } from '@ui/service-status-item';
import { NoticesSectionComponent, Notice } from '@ui/notices-section';
import { NgFor } from '@angular/common';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RoutePathPipe } from '@ui/routing';
import type { ApplicationHealthFeedItem } from '@domains/feed';

export const APPLICATION_HEALTH_FEED_ITEM_SELECTOR = 'application-health-feed-item';

@Component({
  selector: APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
  templateUrl: './application-health-feed-item.component.html',
  styleUrl: './application-health-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    StatusBannerComponent,
    ServiceStatusItemComponent,
    NoticesSectionComponent,
    NgFor,
    RouterLink,
    TuiButton,
    TuiIcon,
    RoutePathPipe
  ]
})
export class ApplicationHealthFeedItemComponent implements IFeedItemComponent {
  @Input() ctaPath = "";
  @Input() item!: ApplicationHealthFeedItem;

  getApplicationSlug(): string {
    return this.item.appSlug;
  }

  getApplicationHealthLink(): string[] {
    return ['/app', this.getApplicationSlug(), 'health'];
  }

  getOverallStatus(): 'operational' | 'degraded' | 'outage' {
    return this.item.overallStatus;
  }

  getStatusMessage(): string {
    return this.item.statusMessage;
  }

  getCurrentTimestamp(): Date {
    return this.item.timestamp;
  }

  getServices(): ServiceStatus[] {
    return this.item.services;
  }

  getNotices(): Notice[] {
    // Convert the DTO notices to the UI component expected format
    return this.item.notices.map(notice => ({
      id: `notice-${Date.now()}-${Math.random()}`,
      date: notice.timestamp || new Date(),
      severity: notice.type === 'error' ? 'error' : notice.type === 'warning' ? 'warning' : 'info',
      title: notice.title || 'Notice',
      message: notice.message || '',
      timestamp: notice.timestamp || new Date(),
      type: notice.type || 'info'
    }));
  }
}
