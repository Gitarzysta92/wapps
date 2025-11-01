import { FeedItemDto } from "./feed-item.dto";

export type CoverImageDto = {
  url: string;
  alt: string;
};

export type ApplicationTeaserFeedItemDto = {
  appSlug: string;
  appId: string;
  appName: string;
  description: string;
  category: {
    name: string;
    slug: string;
  };
  tags: {
    name: string;
    slug: string
  }[];
  coverImage: CoverImageDto;
  aggregatedScore: number;
  reviewsCount: number;
} & FeedItemDto;