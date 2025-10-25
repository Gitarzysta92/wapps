import { FeedItemDto } from "./feed-item.dto";

export type CoverImageDto = {
  url: string;
  alt?: string;
};

export type ApplicationTeaserFeedItem = {
  params: {
    applicationSlug?: string;
    applicationId?: string;
    applicationName?: string;
    description?: string;
    category?: string;
    tags?: string[];
    coverImage?: CoverImageDto;
    aggregatedScore?: number;
    reviewsCount?: number;
    categoryLink?: string;
    reviewsLink?: string;
  };
} & FeedItemDto;
