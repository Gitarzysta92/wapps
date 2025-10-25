import { FeedItemDto } from "./feed-item.dto";

export interface SuiteApp {
  name: string;
  logo?: string;
  description?: string;
}

export type SuiteTeaserFeedItem = {
  params: {
    suiteTitle?: string;
    suiteDescription?: string;
    apps?: SuiteApp[];
    category?: string;
  };
} & FeedItemDto;
