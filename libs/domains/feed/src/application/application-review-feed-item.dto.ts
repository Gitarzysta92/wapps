import { FeedItemDto } from "./feed-item.dto";

export type ApplicationReviewFeedItem = {
  params: {
    applicationSlug?: string;
    applicationId?: string;
    rating?: number;
    reviewerName?: string;
    reviewerAvatar?: string;
    reviewerRole?: string;
    testimonial?: string;
    applicationName?: string;
    reviewDate?: string | Date;
    helpfulCount?: number;
  };
} & FeedItemDto;
