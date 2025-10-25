import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IFeedItem, IFeedItemComponent } from '../../models/feed-item.interface';
import { ContentFeedItemComponent } from '@ui/content-feed';
import { DiscussionComponent, type DiscussionData } from '@ui/discussion';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { RoutePathPipe } from '@ui/routing';

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
  @Input() item!: IFeedItem & { title: string, subtitle: string };

  getApplicationSlug(): string {
    console.log(this.item)
    return this.item.params?.['applicationSlug'];
  }


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


