import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { IFeedItem } from '../models/feed-item.interface';

export interface IFeedPage {
  items: IFeedItem[];
  hasMore: boolean;
  nextPage?: number;
}

export interface IFeedProviderPort {
  getFeedPage(page: number, size: number): Observable<IFeedPage>;
}

export const FEED_PROVIDER_TOKEN = new InjectionToken<IFeedProviderPort>('FeedProviderPort');
