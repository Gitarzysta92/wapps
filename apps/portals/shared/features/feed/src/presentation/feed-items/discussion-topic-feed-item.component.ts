import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import type { DiscussionTopicFeedItem } from '@domains/feed';
import { CardHeaderComponent, CardFooterComponent, MediumCardComponent } from '@ui/layout';
import { MediumTitleComponent } from '@ui/content';
import { ShareToggleButtonComponent } from '@portals/shared/features/sharing';
import { FavoriteToggleButtonComponent } from '@portals/shared/features/my-favorites';
import type { ContextMenuItem } from '@ui/context-menu-chip';
import { type AttributionInfoVM } from '@portals/shared/features/attribution';
import { FeedActionsMenuComponent } from '../actions/feed-actions-menu.component';
import { FeedDatePipe } from '../actions/feed-date.pipe';

export const DISCUSSION_TOPIC_FEED_ITEM_SELECTOR = 'discussion-topic-feed-item';
export type DiscussionTopicFeedItemVM = DiscussionTopicFeedItem & {
  topicLink: string;
  contextMenu: ContextMenuItem[];
  attribution?: AttributionInfoVM;
};

@Component({
  selector: DISCUSSION_TOPIC_FEED_ITEM_SELECTOR,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TuiButton, MediumCardComponent, CardHeaderComponent, CardFooterComponent, MediumTitleComponent, ShareToggleButtonComponent, FavoriteToggleButtonComponent, FeedAttributionComponent, FeedActionsMenuComponent, FeedDatePipe],
  styleUrl: './discussion-preview.scss',
  template: `
    <ui-medium-card>
      <ui-card-header slot="header">
        <h3 uiMediumTitle>{{ item.discussionData.topic || item.title }}</h3>
        <p>{{ item.participantsCount }} participants · {{ item.viewsCount }} views</p>
        <small>{{ item.timestamp | feedDate }}</small>
        <favorite-toggle-button slot="right-side" type="discussions" [slug]="item.discussionSlug" />
        <share-toggle-button slot="right-side" size="s" type="discussions" [slug]="item.discussionSlug" [title]="item.discussionData.topic || item.title" [path]="topicLink" />
      </ui-card-header>
      <div class="discussion-preview">
        @for (message of messages; track $index) {
          <article>
            <header><strong>{{ message.author }}</strong> <small>{{ message.timestamp | feedDate }}</small></header>
            <p>{{ message.content }}</p>
          </article>
        } @empty { <p>No messages are available in this preview.</p> }
      </div>
      <a tuiButton size="s" appearance="primary" [routerLink]="topicLink" [attr.aria-label]="'Open discussion: ' + item.discussionData.topic">Open discussion</a>
      <ui-card-footer slot="footer">
        @if (item.attribution) { <feed-attribution [title]="item.title" slot="left-side" [attribution]="item.attribution" /> }
        <feed-actions-menu slot="right-side" [contextMenu]="item.contextMenu" [title]="item.discussionData.topic" />
      </ui-card-footer>
    </ui-medium-card>
  `,
})
export class DiscussionTopicFeedItemComponent {
  @Input() item!: DiscussionTopicFeedItemVM;
  @Input() ctaPath = '';
  get topicLink(): string {
    return this.item.topicLink || `/apps/${encodeURIComponent(this.item.appSlug)}/discussions/${encodeURIComponent(this.item.discussionSlug)}`;
  }
  get messages(): { author: string; content: string; timestamp: unknown }[] {
    return (this.item.discussionData.messages ?? []).flatMap(value => {
      if (!value || typeof value !== 'object' || !('content' in value) || typeof value.content !== 'string') return [];
      return [{
        content: value.content,
        author: 'author' in value && typeof value.author === 'string' ? value.author : 'Community member',
        timestamp: 'timestamp' in value ? value.timestamp : undefined,
      }];
    }).slice(0, 3);
  }
}
