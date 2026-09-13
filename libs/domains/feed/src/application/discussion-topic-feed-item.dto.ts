import { FeedItemDto } from "./feed-item.dto";

/** Selected excerpts captured with the feed item, independent of the live thread. */
export type DiscussionSnapshotMessage = {
  id?: string | number;
  author: string;
  authorAvatarUrl?: string;
  content: string;
  timestamp?: Date | string | number | null;
};

export type DiscussionTopicFeedItem = {
  appSlug: string;
  discussionSlug: string;
  discussionData: {
    topic: string;
    /** Curated context and significant replies, in display order. */
    messages: DiscussionSnapshotMessage[];
  };
  participantsCount: number;
  viewsCount: number;
} & FeedItemDto;
