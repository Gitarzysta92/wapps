import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { StatusBannerComponent, ServiceStatusItemComponent, NoticesSectionComponent } from '@apps/portals/shared/features/health-status';
import { NgFor } from '@angular/common';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import type { ApplicationHealthFeedItemDto } from '@domains/feed';

export const APPLICATION_HEALTH_FEED_ITEM_SELECTOR = 'application-health-feed-item';

export type ApplicationHealthFeedItemVM = Omit<ApplicationHealthFeedItemDto, 'category' | 'tags'> & {
  appLink: string;
}

@Component({
  selector: APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
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
  ],
  template: `
    <content-feed-item
      icon="@tui.heart-pulse"
      [item]="item">
      <div class="item-content" content>
        <health-status-banner
          [status]="item.overallStatus"
          [message]="item.statusMessage"
          [timestamp]="item.timestamp">
        </health-status-banner>
        
        <health-service-status-item
          *ngFor="let service of item.services"
          [service]="service">
        </health-service-status-item>
        
        <health-notices-section
          [notices]="noticesList"
          [showEmptyState]="true">
        </health-notices-section>
        
        <a
          class="health-cta" 
          tuiButton 
          size="s" 
          appearance="primary"
          [routerLink]="item.appLink">
            <tui-icon icon="@tui.external-link"/>
            View Full Health Status
        </a>
      </div>
      <div footer>
        <ng-content></ng-content>
      </div>
    </content-feed-item>
  `,
  styles: [`
    .item-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .health-cta {
      margin-top: 1rem;
    }
  `]
})
export class ApplicationHealthFeedItemComponent {
  @Input() item!: ApplicationHealthFeedItemVM;

  get noticesList() {
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
