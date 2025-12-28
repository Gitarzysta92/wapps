import { FeedItemDto } from "./feed-item.dto";

export type CoverImageDto = {
  url: string;
  alt: string;
};

export type ArticleHighlightFeedItem = {
  title: string;
  publicationDate: number;
  excerpt: string;
  author: string;
  category: string;
  coverImage: CoverImageDto;
  tags?: any[];
} & FeedItemDto;
