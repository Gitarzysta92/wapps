import { FeedItemDto } from "./feed-item.dto";

export type CoverImageDto = {
  url: string;
  alt?: string;
};

export type ArticleHighlightFeedItem = {
  params: {
    title?: string;
    excerpt?: string;
    author?: string;
    category?: string;
    coverImage?: CoverImageDto;
  };
} & FeedItemDto;
