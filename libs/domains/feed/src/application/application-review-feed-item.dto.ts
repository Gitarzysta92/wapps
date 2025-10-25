import { FeedItemDto } from "./feed-item.dto";

export type ApplicationReviewFeedItem = {
  appSlug: string;
  appId: string;
  rating: number;
  reviewerName: string;
  reviewerAvatar: string;
  reviewerRole: string;
  testimonial: string;
  appName: string;
  reviewDate: string | Date;
  helpfulCount: number;
} & FeedItemDto;
