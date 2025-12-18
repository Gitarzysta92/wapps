import { FeedItemDto } from "./feed-item.dto";

export type ApplicationReviewFeedItem = {
  appSlug: string;
  appId: string;
  rating: number;
  reviewerName: string;
  reviewerRole: string;
  reviewerBadges: { id: string; name: string; icon: string; color: string }[];
  testimonial: string;
  appName: string;
  reviewDate: string | Date;
  helpfulCount: number;
} & FeedItemDto;
