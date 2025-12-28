import { FeedItemDto } from "./feed-item.dto";

export enum ApplicationHealthStatusCode {
  Operational = 0,
  Degraded = 1,
  Outage = 2,
}

export enum NoticeType {
  Info = 0,
  Warning = 1,
  Error = 2,
}
export type ApplicationHealthFeedItemDto = {
  appSlug: string;
  appId: string;
  overallStatus: ApplicationHealthStatusCode;
  statusMessage: string;
  statusesHistory: Array<{ status: ApplicationHealthStatusCode; timestamp: number }>;
  notice: {
    type: NoticeType;
    title: string;
    message: string;
    timestamp: Date;
  } | null;
} & FeedItemDto;
