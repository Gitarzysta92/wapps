import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscussionComponent } from '@ui/discussion';
import { DiscussionStatsBadgeComponent } from '@portals/shared/features/discussion';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';
import { RoutePathPipe } from '@ui/routing';
import type { DiscussionTopicFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { AppAvatarComponent } from '@portals/shared/features/app';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { ContextMenuChipComponent, type ContextMenuItem } from '@ui/context-menu-chip';
import { AttributionInfoBadgeComponent, type AttributionInfoVM } from '@portals/shared/features/attribution';

export const DISCUSSION_TOPIC_FEED_ITEM_SELECTOR = 'discussion-topic-feed-item';

export type DiscussionTopicFeedItemVM = Omit<DiscussionTopicFeedItem, never> & {
  appLink: string;
  topicLink: string;
  contextMenu: ContextMenuItem[];
  attribution?: AttributionInfoVM;
}

@Component({
  selector: DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
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
    DiscussionComponent,
    DiscussionStatsBadgeComponent,
    TuiChip,
    TuiButton,
    TuiIcon,
    RouterLink,
    RoutePathPipe
  ],
  styles: [`
    .discussion-chip {
      background-color: var(--tui-status-info);
      color: white;
    }
    .discussion-label {
      display: inline-flex;
      align-items: center;
      opacity: 0.5;
      margin-left: 0.5rem;
    }
    .discussion-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }
    .discussion-stats {
      display: flex;
      gap: 1.5rem;
      color: var(--tui-text-secondary);
      font-size: 0.875rem;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .discussion-stats-badge {
      opacity: 0.5;
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
          <span class="discussion-label">
            discussion <tui-icon [style.height]="'16px'" icon="@tui.message-square-text" />
          </span>
        </h3>
        <discussion-stats-badge
          class="discussion-stats-badge"
          [stats]="{ participants: item.participantsCount, views: item.viewsCount }" />

        <share-toggle-button
          appearance="action-soft"
          slot="right-side"
          size="s"
          type="discussions"
          [slug]="item.topicSlug"
          [title]="item.discussionData.topic"
        />
      </ui-card-header>
      
      <div class="discussion-content">
        <ui-discussion
          [data]="discussionData"

          [maxMessagesToShow]="3">
        </ui-discussion>
      </div>

      <a
        tuiButton 
        size="s" 
        appearance="primary"
        [routerLink]="ctaPath | routePath:{ appSlug: item.appSlug, topicSlug: item.topicSlug }">
          <tui-icon icon="@tui.message-circle"/>
          Join Discussion
      </a>

      <ui-card-footer slot="footer">
        <attribution-info-badge slot="left-side" [attribution]="item.attribution" />
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
export class DiscussionTopicFeedItemComponent {
  @Input() item!: DiscussionTopicFeedItemVM;
  @Input() ctaPath = '';

  get discussionData() {
    return {
      topic: this.item.discussionData.topic,
      messages: this.item.discussionData.messages.map((msg: unknown) => {
        const message = msg as { id?: string; author?: string; content?: string; timestamp?: Date };
        return {
          id: message.id || `msg-${Date.now()}-${Math.random()}`,
          author: message.author || 'Anonymous',
          message: message.content || '',
          timestamp: message.timestamp || new Date()
        };
      })
    };
  }
}
