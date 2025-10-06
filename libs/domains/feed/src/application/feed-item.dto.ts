export type FeedItemDto = {
  id: string;
  type: string;
  params: { [key: string]: unknown };
  timestamp: Date;
}