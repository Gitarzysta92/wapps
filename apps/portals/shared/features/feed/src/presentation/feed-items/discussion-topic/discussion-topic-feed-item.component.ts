import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { DiscussionComponent, type DiscussionData } from '@ui/discussion';
import { TuiChip } from '@taiga-ui/kit';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

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
    TuiChip,
    TuiButton,
    TuiIcon
  ]
})
export class DiscussionTopicFeedItemComponent implements IFeedItemComponent {
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getDiscussionData(): DiscussionData {
    return this.item.params?.['discussionData'] || {
      topic: 'Trending Discussion',
      messages: []
    };
  }

  getParticipantsCount(): number {
    return this.item.params?.['participantsCount'] || 0;
  }

  getViewsCount(): number {
    return this.item.params?.['viewsCount'] || 0;
  }
}

