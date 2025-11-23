import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { map } from "rxjs";
import { MY_FAVORITES_STATE_PROVIDER } from "../../application/my-favorites-state-provider.token";

@Component({
  selector: "my-favorites-list",
  templateUrl: 'my-favorites-list.component.html',
  styleUrls: ['my-favorites-list.component.scss'],
  imports: [
    AsyncPipe
  ]
})
export class MyFavoritesListComponent {

  private readonly _favoritesProvider = inject(MY_FAVORITES_STATE_PROVIDER);

  public readonly favorites$ = this._favoritesProvider.myFavorites$.pipe(
    map(state => state.data)
  );

  public readonly isLoading$ = this._favoritesProvider.myFavorites$.pipe(
    map(state => state.isLoading)
  );

  public readonly isError$ = this._favoritesProvider.myFavorites$.pipe(
    map(state => state.isError)
  );
}

