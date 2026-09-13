import { FeedAttributionComponent } from '../actions/feed-attribution.component';
import { ChangeDetectionStrategy, Component, computed, Input, signal } from '@angular/core';
import { QuickDiscussionButtonComponent } from '@portals/shared/features/discussion';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import type { DiscussionTopicFeedItem } from '@domains/feed';
import { CardHeaderComponent, MediumCardComponent } from '@ui/layout';
import { MediumTitleComponent } from '@ui/content';
import { DiscussionThreadComponent, DiscussionPostComponent, DiscussionPostHeaderComponent, DiscussionExpandablePostContentComponent, type DiscussionPostVM } from '@ui/discussion';
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
  imports: [RouterLink, TuiButton, MediumCardComponent, CardHeaderComponent, MediumTitleComponent, ShareToggleButtonComponent, FavoriteToggleButtonComponent, FeedAttributionComponent, FeedActionsMenuComponent, FeedDatePipe, QuickDiscussionButtonComponent,
    DiscussionThreadComponent, DiscussionPostComponent, DiscussionPostHeaderComponent, DiscussionExpandablePostContentComponent],
  styleUrl: './discussion-preview.scss',
  template: `
    <ui-medium-card>
      <ui-card-header slot="header">
        <h3 uiMediumTitle>{{ item.discussionData.topic || item.title }}</h3>
        <p>{{ item.participantsCount }} participants · {{ item.viewsCount }} views</p>
        <small>Discussion highlights · {{ item.timestamp | feedDate }}</small>
      </ui-card-header>

      @if (messages()[0]; as openingPost) {
        <ui-discussion-thread>
          <ui-discussion-post slot="opening-post" [post]="openingPost" role="article" aria-label="Opening post">
            <ui-discussion-post-header slot="header" [authorName]="openingPost.author.name" [authorAvatarUrl]="openingPost.author.avatar.url" [publishedTime]="openingPost.publishedTime" />
            <ui-discussion-expandable-post-content slot="content" [content]="openingPost.content" />
          </ui-discussion-post>
          @for (comment of messages().slice(1); track comment.id) {
            <ui-discussion-post slot="reply" [post]="comment" role="article" [attr.aria-label]="'Comment by ' + comment.author.name">
              <ui-discussion-post-header slot="header" [authorName]="comment.author.name" [authorAvatarUrl]="comment.author.avatar.url" [publishedTime]="comment.publishedTime" />
              <ui-discussion-expandable-post-content slot="content" [content]="comment.content" />
            </ui-discussion-post>
          }
        </ui-discussion-thread>
      } @else { <p>No messages are available in this preview.</p> }

      <discussion-quick-button slot="bottom-bar" [appSlug]="item.appSlug" [discussionSlug]="item.discussionSlug" />
      @if (item.attribution) { <feed-attribution [title]="item.title" slot="bottom-bar" [attribution]="item.attribution" /> }

      <ng-template #cardActions>
        <favorite-toggle-button type="discussions" [slug]="item.discussionSlug" />
        <share-toggle-button
          size="s"
          type="discussions"
          [slug]="item.discussionSlug"
          [title]="item.discussionData.topic || item.title"
          [path]="topicLink"
        />
        <a
          tuiButton
          size="s"
          appearance="primary"
          iconStart="@tui.message-circle"
          [routerLink]="topicLink"
          [attr.aria-label]="'Open discussion: ' + item.discussionData.topic"
          >Open full discussion</a
        >
        <feed-actions-menu [contextMenu]="item.contextMenu" [title]="item.discussionData.topic" />
      </ng-template>
    </ui-medium-card>
  `,
})
export class DiscussionTopicFeedItemComponent {
  private readonly itemValue = signal<DiscussionTopicFeedItemVM | undefined>(undefined);
  @Input() set item(value: DiscussionTopicFeedItemVM) { this.itemValue.set(value); }
  get item(): DiscussionTopicFeedItemVM { return this.itemValue()!; }
  @Input() ctaPath = '';
  get topicLink(): string {
    return this.item.topicLink || `/apps/${encodeURIComponent(this.item.appSlug)}/discussions/${encodeURIComponent(this.item.discussionSlug)}`;
  }
  readonly messages = computed<DiscussionPostVM[]>(() => {
    return (this.itemValue()?.discussionData.messages ?? []).flatMap((value, index) => {
      if (!value || typeof value !== 'object' || !('content' in value) || typeof value.content !== 'string') return [];
      const timestamp = 'timestamp' in value ? value.timestamp : undefined;
      const date = timestamp instanceof Date || typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : null;
      return [{
        id: typeof value.id === 'string' || typeof value.id === 'number' ? String(value.id) : `preview-${index}`,
        content: value.content,
        author: { id: '', slug: '', name: typeof value.author === 'string' ? value.author : 'Community member',
          avatar: { url: typeof value.authorAvatarUrl === 'string' ? value.authorAvatarUrl : '' } },
        publishedTime: date && Number.isFinite(date.getTime()) ? date : null,
        upvotesCount: 0, downvotesCount: 0, isEdited: false,
      }];
    }).slice(0, 3);
  });
}
