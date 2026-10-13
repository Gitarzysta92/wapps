import { inject, Injectable, Injector } from '@angular/core';
import { defer, switchMap } from 'rxjs';
import type { CustomerFavoritesDto } from '@domains/customer/favorites';
import type { FavoriteContentPort } from '../application/favorite-content.port';
import { FAVORITES_MODE } from '../application/favorites-session.port';

@Injectable()
export class LazyFavoriteContentService implements FavoriteContentPort {
  private readonly injector = inject(Injector);
  private readonly mode = inject(FAVORITES_MODE);
  resolve(data: CustomerFavoritesDto) {
    return defer(() =>
      this.mode === 'api'
        ? import('./favorite-content-api.service').then(
            ({ FavoriteContentApiService }) =>
              this.injector.get(FavoriteContentApiService)
          )
        : import('./favorite-content-demo.service').then(
            ({ FavoriteContentDemoService }) =>
              this.injector.get(FavoriteContentDemoService)
          )
    ).pipe(switchMap((adapter) => adapter.resolve(data)));
  }
}
