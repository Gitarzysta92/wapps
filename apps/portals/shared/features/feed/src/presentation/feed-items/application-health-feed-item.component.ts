import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusBannerComponent, ServiceStatusItemComponent, NoticesSectionComponent, HealthCheckBadgeComponent } from '@apps/portals/shared/features/health-status';
import { NgFor } from '@angular/common';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadge, TuiChip } from '@taiga-ui/kit';
import type { ApplicationHealthFeedItemDto } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/app';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';
import { DiscussionChipComponent } from '@portals/shared/features/discussion';

export const APPLICATION_HEALTH_FEED_ITEM_SELECTOR = 'application-health-feed-item';

export type ApplicationHealthFeedItemVM = Omit<ApplicationHealthFeedItemDto, 'category' | 'tags'> & {
  appLink: string;
  contextMenu: ContextMenuItem[];
  attribution?: AttributionInfoVM;
  commentsNumber: number;
}

@Component({
  selector: APPLICATION_HEALTH_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MediumCardComponent,
    CardHeaderComponent,
    CardFooterComponent,
    MediumTitleComponent,
    StatusBannerComponent,
    ServiceStatusItemComponent,
    NoticesSectionComponent,
    AppAvatarComponent,
    ShareToggleButtonComponent,
    ContextMenuChipComponent,
    AttributionInfoBadgeComponent,
    DiscussionChipComponent,
    TuiChip,
    NgFor,
    RouterLink,
    TuiButton,
    TuiIcon,
    TuiBadge,
    HealthCheckBadgeComponent,
  ],
  styles: [`
    .health-label {
      display: inline-flex;
      align-items: center;
      opacity: 0.5;
      margin-left: 0.5rem;
    }
    .health-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }
    .health-chip {
      background-color: var(--tui-status-info);
      color: white;
    }
  `],
  template: `
    <ui-medium-card class="medium-card">
      <ui-card-header slot="header">
        <app-avatar
          slot="left-side"
          [size]="'m'"
          [avatar]="{ url: 'https://picsum.photos/200', alt: item.title }"/>
        <h3 uiMediumTitle>
          {{ item.title }}
          <span class="health-label">
            <tui-icon icon="@tui.heart-pulse" /> health status 
          </span>
        </h3>
        <div class="changelog-version">
          <!-- TODO: this has to be mapped outside template -->
          <health-check-badge
            [status]="{ code: item.overallStatus, message: item.statusMessage }"/>
          <!-- <tui-badge class="changelog-badge" size="s"></tui-badge> <small>{{ item.subtitle }}</small> -->
        </div>
        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="applications"
          [slug]="item.appSlug"
          [title]="item.title"
        />
        <button
          tuiButton
          appearance="action-soft"
          size="s"
          slot="right-side"
        >
          <tui-icon icon="@tui.circle-arrow-right" />
        </button>
      </ui-card-header>
      
      <div class="health-content">        
        <!-- <health-status-banner
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
        </health-notices-section> -->
      </div>

      <ui-card-footer slot="footer">
        <attribution-info-badge slot="left-side" [attribution]="item.attribution" />
        <discussion-chip
          slot="right-side"
          [commentsCount]="item.commentsNumber"
          size="xs"
          appearance="action-soft-flat"
        />
        <context-menu-chip
          slot="right-side"
          [contextMenu]="item.contextMenu"
          size="xs"
          appearance="action-soft-flat"
        />
      </ui-card-footer>
    </ui-medium-card>
  `,
})
export class ApplicationHealthFeedItemComponent {
  @Input() item!: ApplicationHealthFeedItemVM;

}
