import { inject, Injectable } from "@angular/core";
import { map, Observable, Subject, switchMap, tap, startWith, shareReplay } from "rxjs";
import { CustomerFavoritesDto } from "@domains/customer/favorites";
import { Result } from "@standard";
import { IMyFavoritesStateProvider } from "./my-favorites-state-provider.port";
import { MyFavoritesState } from "./my-favorites.state";
import { IMyFavoritesProvider } from "./my-favorites-provider.port";
import { MY_FAVORITES_PROVIDER } from "./my-favorites-provider.token";

@Injectable()
export class MyFavoritesService implements IMyFavoritesStateProvider {

  private readonly _myFavoritesProvider = inject<IMyFavoritesProvider>(MY_FAVORITES_PROVIDER);
  private readonly _favoritesUpdated$ = new Subject<void>();

  public myFavorites$: Observable<MyFavoritesState> = this._favoritesUpdated$.pipe(
    startWith(void 0),
    switchMap(() => this._myFavoritesProvider.getMyFavorites()),
    map(result => ({
      isLoading: false,
      isError: !result.ok,
      data: result.ok ? result.value : { applications: [], suites: [], articles: [], discussions: [] } as CustomerFavoritesDto
    })),
    shareReplay(1)
  );

  public addToFavorites(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<Result<boolean, Error>> {
    return this._myFavoritesProvider.addToFavorites(type, slug)
      .pipe(tap(() => {
        this._favoritesUpdated$.next();
      }));
  }

  public removeFromFavorites(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<Result<boolean, Error>> {
    return this._myFavoritesProvider.removeFromFavorites(type, slug)
      .pipe(tap(() => {
        this._favoritesUpdated$.next();
      }));
  }

  public isFavorite$(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<boolean> {
    return this.myFavorites$.pipe(
      map(state => state.data[type].includes(slug))
    );
  }
}

