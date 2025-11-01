import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IFeedItem } from '../models/feed-item.interface';
import { FEED_PROVIDER_TOKEN } from '../ports/feed-provider.port';

@Injectable()
export class NewsFeedService {

  private readonly _feedProvider = inject(FEED_PROVIDER_TOKEN);
  
  private readonly _feedItems$ = new BehaviorSubject<IFeedItem[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _hasMore$ = new BehaviorSubject<boolean>(true);
  
  private _currentPage = 0;
  private readonly _pageSize = 10;

  public readonly feedItems$ = this._feedItems$.asObservable();
  public readonly loading$ = this._loading$.asObservable();
  public readonly hasMore$ = this._hasMore$.asObservable();

  public loadNextPage(): void {
    if (this._loading$.value || !this._hasMore$.value) {
      return;
    }

    this._loading$.next(true);

    this._feedProvider.getFeedPage(this._currentPage, this._pageSize)
      .subscribe(page => {
        const currentItems = this._feedItems$.value;
        const newItems = [...currentItems, ...page.ok ? page.value.items : []];
        
        this._feedItems$.next(newItems);
        this._hasMore$.next(page.ok && page.value.hasMore);
        this._currentPage++;
        this._loading$.next(false);
      });
  }

  public refresh(): void {
    this._currentPage = 0;
    this._feedItems$.next([]);
    this._hasMore$.next(true);
    this.loadNextPage();
  }
}
