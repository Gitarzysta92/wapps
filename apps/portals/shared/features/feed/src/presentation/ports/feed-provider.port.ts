import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { IFeedItem } from '../models/feed-item.interface';
import { Result } from '@foundation/standard';

export interface IFeedPage {
  items: IFeedItem[];
  hasMore: boolean;
  nextPage?: number;
}

export interface IFeedProviderPort {
  getFeedPage(page: number, size: number): Observable<Result<IFeedPage, Error>>;
}

export const FEED_PROVIDER_TOKEN = new InjectionToken<IFeedProviderPort>('FeedProviderPort');
