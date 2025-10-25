import { FeedItemDto } from "./feed-item.dto";

export type CoverImageDto = {
  url: string;
  alt: string;
};

export type ApplicationTeaserFeedItem = {
  appSlug: string;
  appId: string;
  appName: string;
  description: string;
  category: string;
  tags: string[];
  coverImage: CoverImageDto;
  aggregatedScore: number;
  reviewsCount: number;
  categoryLink: string;
  reviewsLink: string;
} & FeedItemDto;
