import { Observable } from "rxjs";
import { MyFavoritesState } from "./my-favorites.state";

export interface IMyFavoritesStateProvider {
  myFavorites$: Observable<MyFavoritesState>;
}

