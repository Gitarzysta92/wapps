import { Component, inject, Input } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { RouterModule } from "@angular/router";
import { TuiButton, TuiIcon } from "@taiga-ui/core";
import { TuiAvatar } from "@taiga-ui/kit";
import { map } from "rxjs";
import { MY_FAVORITES_STATE_PROVIDER } from "../../application/my-favorites-state-provider.token";

@Component({
  selector: "my-favorites-grid",
  templateUrl: 'my-favorites-grid.component.html',
  styleUrls: ['my-favorites-grid.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    RouterModule,
    TuiButton,
    TuiIcon,
    TuiAvatar
  ]
})
export class MyFavoritesGridComponent {

  @Input() maxItems: number = 15;
  @Input() ctaRoute: string = '/apps';
  @Input() ctaLabel: string = 'Browse Apps';
  @Input() itemRoutePrefix: string = '/app';

  private readonly _favoritesProvider = inject(MY_FAVORITES_STATE_PROVIDER);

  public readonly favoriteApps$ = this._favoritesProvider.myFavorites$.pipe(
    map(state => state.data.applications)
  );

  public readonly isLoading$ = this._favoritesProvider.myFavorites$.pipe(
    map(state => state.isLoading)
  );

  public readonly isError$ = this._favoritesProvider.myFavorites$.pipe(
    map(state => state.isError)
  );
}

