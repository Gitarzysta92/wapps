import { DestroyRef, Injectable, inject } from '@angular/core';
import { BehaviorSubject, finalize, Subscription, take } from 'rxjs';
import { IFeedItem } from '../models/feed-item.interface';
import { FEED_PROVIDER_TOKEN } from '../ports/feed-provider.port';

@Injectable()
export class NewsFeedService {

  private readonly _feedProvider = inject(FEED_PROVIDER_TOKEN);
  
  private readonly _feedItems$ = new BehaviorSubject<IFeedItem[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _hasMore$ = new BehaviorSubject<boolean>(true);
  private readonly _error$ = new BehaviorSubject<boolean>(false);
  private readonly _loaded$ = new BehaviorSubject<boolean>(false);
  private request?: Subscription;
  
  private _currentPage = 0;
  private readonly _pageSize = 10;

  public readonly feedItems$ = this._feedItems$.asObservable();
  public readonly loading$ = this._loading$.asObservable();
  public readonly hasMore$ = this._hasMore$.asObservable();
  public readonly error$ = this._error$.asObservable();
  public readonly loaded$ = this._loaded$.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  public loadNextPage(): void {
    if (this._loading$.value || !this._hasMore$.value) {
      return;
    }

    this._loading$.next(true);
    this._error$.next(false);

    this.request = this._feedProvider.getFeedPage(this._currentPage, this._pageSize)
      .pipe(take(1), finalize(() => this._loading$.next(false)))
      .subscribe({
        next: page => {
          this._loaded$.next(true);
          if (!page.ok) {
            this._error$.next(true);
            return;
          }
          this._feedItems$.next([...this._feedItems$.value, ...page.value.items]);
          this._hasMore$.next(page.value.hasMore);
          this._currentPage++;
        },
        error: () => this._error$.next(true),
      });
  }

  public refresh(): void {
    this.request?.unsubscribe();
    this._currentPage = 0;
    this._loaded$.next(false);
    this._error$.next(false);
    this._feedItems$.next([]);
    this._hasMore$.next(true);
    this.loadNextPage();
  }
}
