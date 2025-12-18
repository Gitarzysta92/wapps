import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { HealthCheckBadgeComponent, StatusHistoryComponent } from '@apps/portals/shared/features/health-status';
import { NgIf, DatePipe } from '@angular/common';
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
    AppAvatarComponent,
    ShareToggleButtonComponent,
    ContextMenuChipComponent,
    AttributionInfoBadgeComponent,
    DiscussionChipComponent,
    TuiChip,
    NgIf,
    DatePipe,
    TuiButton,
    TuiIcon,
    TuiBadge,
    HealthCheckBadgeComponent,
    StatusHistoryComponent,
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
    }
    .health-chip {
      background-color: var(--tui-status-info);
      color: white;
    }
    .notice-details {
      border: 4px solid var(--tui-status-info);
      margin-top: 1rem;
    }
    .notice-details.warning {
      border-color: var(--tui-status-warning);
    }
    .notice-details.error {
      border-color: var(--tui-status-negative);
    }
    .notice-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .notice-message {
      line-height: 1.5;
    }
    .status-history {
      margin: 1.5rem 0 1rem 0;
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
            health status <tui-icon [style.height]="'16px'" icon="@tui.heart-pulse" />
          </span>
        </h3>
        <div class="changelog-version">
          <!-- TODO: this has to be mapped outside template -->
          <health-check-badge
            [status]="{ code: item.overallStatus, message: item.statusMessage }"/>
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
      
      <status-history
        class="status-history"
        [statusesHistory]="item.statusesHistory" />

      <ui-medium-card 
        *ngIf="item.notice" 
        class="notice-details"
        [class.warning]="item.notice.type === 1"
        [class.error]="item.notice.type === 2">
        <tui-chip size="s" appearance="action-soft" slot="top-edge">
          <tui-icon [icon]="getNoticeIcon(item.notice.type)" /> {{ item.notice.title }}
        </tui-chip>
        <div class="notice-content">
          <p class="notice-message">{{ item.notice.message }}</p>
          <small style="opacity: 0.5">{{ item.notice.timestamp | date:'medium' }}</small>
        </div>
      </ui-medium-card>

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

  getNoticeIcon(type: number): string {
    switch (type) {
      case 0: return '@tui.info';
      case 1: return '@tui.alert-circle';
      case 2: return '@tui.alert-triangle';
      default: return '@tui.info';
    }
  }
}
