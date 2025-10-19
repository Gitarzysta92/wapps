export type FeedItemDto = {
  id: string;
  type: string;
  title: string;
  params: { [key: string]: unknown };
  timestamp: Date;
}