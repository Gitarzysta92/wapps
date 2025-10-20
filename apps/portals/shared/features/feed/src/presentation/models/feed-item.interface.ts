export interface IFeedItem {
  id: string;
  type: string;
  timestamp: Date;
  params?: Record<string, any>;
}


export enum FeedItemPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface IFeedItemComponent {
  item: IFeedItem;
}
