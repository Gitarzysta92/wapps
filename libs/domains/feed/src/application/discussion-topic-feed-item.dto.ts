import { FeedItemDto } from "./feed-item.dto";

export type DiscussionTopicFeedItem = {
  appSlug: string;
  topicSlug: string;
  discussionData: {
    topic: string;
    messages: unknown[];
  };
  participantsCount: number;
  viewsCount: number;
} & FeedItemDto;
