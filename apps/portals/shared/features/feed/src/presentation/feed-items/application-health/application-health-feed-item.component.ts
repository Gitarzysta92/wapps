import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { StatusBannerComponent } from '@ui/status-banner';
import { ServiceStatusItemComponent, ServiceStatus } from '@ui/service-status-item';
import { NoticesSectionComponent, Notice } from '@ui/notices-section';
import { NgFor } from '@angular/common';

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
    NgFor
  ]
})
export class ApplicationHealthFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem & { title: string } & any;

  getOverallStatus(): 'operational' | 'degraded' | 'outage' {
    const status = this.item.params?.['overallStatus'];
    return status || 'operational';
  }

  getStatusMessage(): string {
    return this.item.params?.['statusMessage'] || 'All Systems Operational';
  }

  getCurrentTimestamp(): Date {
    return this.item.timestamp || new Date();
  }

  getServices(): ServiceStatus[] {
    return this.item.params?.['services'] || [
      {
        name: 'OpenStatus',
        uptime: 99.99,
        status: 'operational',
        hasInfo: true
      },
      {
        name: 'OTEL Test',
        uptime: 100,
        status: 'operational'
      }
    ];
  }

  getNotices(): Notice[] {
    return this.item.params?.['notices'] || [];
  }
}
