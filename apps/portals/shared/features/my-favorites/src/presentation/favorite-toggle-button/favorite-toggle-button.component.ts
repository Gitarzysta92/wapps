import { AsyncPipe } from "@angular/common";
import { Component, inject, Input, OnChanges, signal } from "@angular/core";
import { TuiButton } from "@taiga-ui/core";
import { Observable, of } from "rxjs";
import { MyFavoritesService } from "../../application/my-favorites.service";

@Component({
  selector: "favorite-toggle-button",
  templateUrl: 'favorite-toggle-button.component.html',
  styleUrls: ['favorite-toggle-button.component.scss'],
  imports: [
    AsyncPipe,
    TuiButton
  ]
})
export class FavoriteToggleButtonComponent implements OnChanges {

  @Input({ required: true }) type!: 'applications' | 'suites' | 'articles' | 'discussions';
  @Input({ required: true }) slug!: string;

  @Input() iconOnly = false;

  private readonly _favoritesService = inject(MyFavoritesService);

  public isFavorite$: Observable<boolean> = of(false);
  public readonly error = signal('');

  ngOnChanges() {
    if (!this.type || !this.slug) {
      throw new Error('FavoriteToggleButtonComponent requires type and slug inputs');
    }
    this.isFavorite$ = this._favoritesService.isFavorite$(this.type, this.slug);
  }

  public toggleFavorite(isFavorite: boolean): void {
    this.error.set('');
    const operation = isFavorite
      ? this._favoritesService.removeFromFavorites(this.type, this.slug)
      : this._favoritesService.addToFavorites(this.type, this.slug);
    operation.subscribe(result => {
      if (!result.ok) this.error.set(result.error.message);
    });
  }
}

