import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { DiscussionComponent, type DiscussionData } from '@ui/discussion';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RoutePathPipe } from '@ui/routing';
import type { DiscussionTopicFeedItem } from '@domains/feed';

export const DISCUSSION_TOPIC_FEED_ITEM_SELECTOR = 'discussion-topic-feed-item';

@Component({
  selector: DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
  templateUrl: './discussion-topic-feed-item.component.html',
  styleUrl: './discussion-topic-feed-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContentFeedItemComponent,
    DiscussionComponent,
    TuiButton,
    TuiIcon,
    RouterLink,
    RoutePathPipe
  ]
})
export class DiscussionTopicFeedItemComponent implements IFeedItemComponent {
  @Input() ctaPath = ''
  @Input() item!: DiscussionTopicFeedItem;

  getApplicationSlug(): string {
    return this.item.appSlug;
  }

  getDiscussionData(): DiscussionData {
    // Convert the DTO discussion data to the UI component expected format
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

  getParticipantsCount(): number {
    return this.item.participantsCount;
  }

  getViewsCount(): number {
    return this.item.viewsCount;
  }
}


