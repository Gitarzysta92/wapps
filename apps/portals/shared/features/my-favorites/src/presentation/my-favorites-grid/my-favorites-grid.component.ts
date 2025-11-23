import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { TuiAvatar } from "@taiga-ui/kit";

export interface FavoriteAppItem {
  slug: string;
  path: string;
  avatarUrl?: string;
  title?: string;
}

export interface MyFavoritesGridViewModel {
  items: FavoriteAppItem[];
  hasItems: boolean;
}

@Component({
  selector: "my-favorites-grid",
  templateUrl: 'my-favorites-grid.component.html',
  styleUrls: ['my-favorites-grid.component.scss'],
  standalone: true,
  imports: [
    RouterModule,
    TuiAvatar
  ]
})
export class MyFavoritesGridComponent {

  @Input({ required: true }) vm!: MyFavoritesGridViewModel;
  @Input() maxItems = 15;
}

