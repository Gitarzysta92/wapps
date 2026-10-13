import { inject, Injectable, Injector } from '@angular/core';
import { defer, switchMap, type Observable } from 'rxjs';
import {
  FAVORITES_SESSION,
  FAVORITES_MODE,
  FavoritesSaveError,
} from '../application/favorites-session.port';
import type {
  FavoritesCommand,
  IMyFavoritesProvider,
} from '../application/my-favorites-provider.port';

@Injectable()
export class LazyMyFavoritesService implements IMyFavoritesProvider {
  private readonly injector = inject(Injector);
  private readonly mode = inject(FAVORITES_MODE);
  private readonly session = inject(FAVORITES_SESSION);
  getMyFavorites() {
    return this.request((api) => api.getMyFavorites());
  }
  change(command: FavoritesCommand) {
    return this.request((api) => api.change(command));
  }
  private request<T>(operation: (api: IMyFavoritesProvider) => Observable<T>) {
    const session = this.session.currentKey();
    return defer(() =>
      this.mode === 'api'
        ? import('./my-favorites-api.service').then(
            ({ MyFavoritesApiService }) =>
              this.injector.get(MyFavoritesApiService)
          )
        : import('./my-favorites-demo.service').then(
            ({ MyFavoritesDemoService }) =>
              this.injector.get(MyFavoritesDemoService)
          )
    ).pipe(
      switchMap((adapter) => {
        if (!session || session !== this.session.currentKey())
          throw new FavoritesSaveError(
            'session',
            'The account session changed. Reload favorites before continuing.'
          );
        return operation(adapter);
      })
    );
  }
}
