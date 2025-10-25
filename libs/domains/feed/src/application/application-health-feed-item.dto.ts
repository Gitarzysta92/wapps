import { FeedItemDto } from "./feed-item.dto";

export type ServiceStatus = {
  name: string;
  uptime?: number;
  status: 'operational' | 'degraded' | 'outage';
  hasInfo?: boolean;
};

export type Notice = {
  type?: 'info' | 'warning' | 'error';
  title?: string;
  message?: string;
  timestamp?: Date;
};

export type ApplicationHealthFeedItem = {
  params: {
    applicationSlug?: string;
    applicationId?: string;
    overallStatus?: 'operational' | 'degraded' | 'outage';
    statusMessage?: string;
    services?: ServiceStatus[];
    notices?: Notice[];
  };
} & FeedItemDto;
