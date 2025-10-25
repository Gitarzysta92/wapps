import { FeedItemDto } from "./feed-item.dto";

export type ApplicationDevLogFeedItem = {
  appSlug: string;
  appName: string;
  version: string;
  description: string;
  releaseDate: Date;
  changes: Array<{
    description: string;
    type: unknown;
  }>;
  type: unknown;
} & FeedItemDto