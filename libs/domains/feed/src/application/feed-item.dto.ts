export type FeedItemDto = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  params: { [key: string]: unknown };
  timestamp: Date;
}