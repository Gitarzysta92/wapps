import { FeedItemDto } from "./feed-item.dto";
import { ContentAttributionDto } from "@domains/publication/attribution";

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
  attribution?: ContentAttributionDto;
} & FeedItemDto;