export type FeedItemDto = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  timestamp: Date;
  /** The specific discussion associated with this item, when available. */
  discussionSlug?: string;
}


