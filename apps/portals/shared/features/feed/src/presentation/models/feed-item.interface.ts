export interface IFeedItem {
  id: string;
  type: FeedItemType;
  timestamp: Date;
  priority: FeedItemPriority;
  metadata?: Record<string, any>;
}

export enum FeedItemType {
  ARTICLE_HIGHLIGHT = 'article-highlight',
  APPLICATION_HEALTH = 'application-health',
  FORUM_REPLY = 'forum-reply',
  CHANGELOG_UPDATE = 'changelog-update',
  APPLICATION_AD = 'application-ad',
  SUITE_UPDATE = 'suite-update',
  USER_POST = 'user-post',
  SYSTEM_NOTIFICATION = 'system-notification'
}

export enum FeedItemPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface IFeedItemComponent {
  item: IFeedItem;
}
