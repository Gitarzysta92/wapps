import { QuickDiscussionButtonComponent } from '@portals/shared/features/discussion';
import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { RouterLink } from '@angular/router';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { HealthCheckBadgeComponent, StatusHistoryComponent } from '@apps/portals/shared/features/health-status';
import { NgIf, DatePipe } from '@angular/common';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiBadge, TuiChip } from '@taiga-ui/kit';
import type { ApplicationHealthFeedItemDto } from '@domains/feed';
import { CardHeaderComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/application-overview';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { type ContextMenuItem } from '@ui/context-menu-chip';
import { type AttributionInfoVM } from '@portals/shared/features/attribution';

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
    QuickDiscussionButtonComponent,
    RouterLink,
    MediumCardComponent,
    CardHeaderComponent,
    MediumTitleComponent,
    AppAvatarComponent,
    ShareToggleButtonComponent,
    FeedActionsMenuComponent,
    FeedAttributionComponent,
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
      @if (item.discussionSlug; as discussionSlug) {
        <discussion-quick-button slot="bottom-bar" [appSlug]="item.appSlug" [discussionSlug]="discussionSlug" />
      }
      @if (item.attribution) { <feed-attribution [title]="item.title" slot="bottom-bar-end" [attribution]="item.attribution" /> }
      <ng-template #cardFooterActions let-iconOnly="iconOnly" let-activeZone="activeZone">
        <share-toggle-button [iconOnly]="iconOnly" [activeZone]="activeZone ?? null"
          appearance="flat"
          size="xs"
          type="applications"
          [slug]="item.appSlug"
          [path]="item.appLink"
          [title]="item.title"
        />
      </ng-template>

      <ng-template #cardActions let-iconOnly="iconOnly">
        <feed-actions-menu [iconOnly]="iconOnly"
          [contextMenu]="item.contextMenu"
          [title]="item.title"
        />
        <a
          tuiButton
          appearance="primary"
          size="s"
          iconStart="@tui.arrow-right"
          [routerLink]="item.appLink"
          [attr.aria-label]="'View status: ' + item.title"
          >View status</a
        >
      </ng-template>
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
