import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { TuiTitle } from '@taiga-ui/core';
import { TuiCardLarge, TuiHeader } from '@taiga-ui/layout';
import { MY_FAVORITES_STATE_PROVIDER, MyFavoritesGridComponent, MyFavoritesGridViewModel, FavoriteAppItem } from '@portals/shared/features/my-favorites';
import { map } from 'rxjs';
import { NAVIGATION } from '../../navigation';

@Component({
  selector: 'favorites-page',
  templateUrl: 'favorites.component.html',
  styleUrl: 'favorites.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    TuiTitle,
    TuiCardLarge,
    TuiHeader,
    MyFavoritesGridComponent,
  ]
})
export class FavoritesPageComponent {
  private readonly myFavoritesStateProvider = inject(MY_FAVORITES_STATE_PROVIDER);

  protected readonly favoritesViewModel$ = this.myFavoritesStateProvider.myFavorites$.pipe(
    map(state => {
      const items: FavoriteAppItem[] = state.data.applications.map(slug => ({
        slug,
        path: `/${NAVIGATION.application.path.replace(':appSlug', slug)}`,
        title: slug,
        avatarUrl: undefined
      }));

      return {
        items,
        hasItems: items.length > 0
      } as MyFavoritesGridViewModel;
    })
  );

  protected readonly isLoading$ = this.myFavoritesStateProvider.myFavorites$.pipe(
    map(state => state.isLoading)
  );

  protected readonly isError$ = this.myFavoritesStateProvider.myFavorites$.pipe(
    map(state => state.isError)
  );
}

