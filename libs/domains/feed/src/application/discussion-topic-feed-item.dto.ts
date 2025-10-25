import { FeedItemDto } from "./feed-item.dto";

export type DiscussionTopicFeedItem = {
  params: {
    applicationSlug?: string;
    discussionData?: {
      topic: string;
      messages: unknown[];
    };
    participantsCount?: number;
    viewsCount?: number;
  };
} & FeedItemDto;
