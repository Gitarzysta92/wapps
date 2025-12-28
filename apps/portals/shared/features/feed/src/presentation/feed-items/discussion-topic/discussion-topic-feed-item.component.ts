import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { DiscussionComponent } from '@ui/discussion';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RoutePathPipe } from '@ui/routing';
import type { DiscussionTopicFeedItem } from '@domains/feed';

export const DISCUSSION_TOPIC_FEED_ITEM_SELECTOR = 'discussion-topic-feed-item';

export type DiscussionTopicFeedItemVM = Omit<DiscussionTopicFeedItem, never> & {
  appLink: string;
  topicLink: string;
}

@Component({
  selector: DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    DiscussionComponent,
    TuiButton,
    TuiIcon,
    RouterLink,
    RoutePathPipe
  ],
  template: `
    <content-feed-item
      icon="@tui.message-square"
      [item]="item">
      <div class="item-content" content>
        <ui-discussion
          [data]="discussionData"
          [readonly]="true"
          [maxMessagesToShow]="3"
          class="discussion">
        </ui-discussion>

        <a
          class="discussion-cta" 
          tuiButton 
          size="s" 
          appearance="primary"
          [routerLink]="ctaPath | routePath:{ appSlug: item.appSlug, topicSlug: item.topicSlug }">
            <tui-icon icon="@tui.message-circle"/>
            Join Discussion
        </a>
      </div>

      <div class="item-actions" footer>
        <div class="stats-group">
          <div class="stat-item">
            <tui-icon icon="@tui.users" />
            <span>{{ item.participantsCount }} participants</span>
          </div>
          <div class="stat-item">
            <tui-icon icon="@tui.eye" />
            <span>{{ item.viewsCount }} views</span>
          </div>
        </div>
        <button 
          class="action-btn"
          tuiButton
          size="s"
          appearance="flat">
            <tui-icon icon="@tui.bookmark" />
            Follow
        </button>
      </div>
    </content-feed-item>
  `,
  styles: [`
    .item-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }

    .discussion {
      width: 100%;
    }

    .discussion-cta {
      align-self: flex-start;
    }

    .item-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-top: 1px solid var(--tui-border-normal);
    }

    .stats-group {
      display: flex;
      gap: 1.5rem;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--tui-text-secondary);
    }
  `]
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
