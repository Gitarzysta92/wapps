import { AsyncPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnChanges,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TuiButton } from '@taiga-ui/core';
import { Observable, of, Subscription } from 'rxjs';
import type { FavoriteKind } from '@domains/customer/favorites';
import { MyFavoritesService } from '../../application/my-favorites.service';

@Component({
  selector: 'favorite-toggle-button',
  templateUrl: 'favorite-toggle-button.component.html',
  styleUrls: ['favorite-toggle-button.component.scss'],
  imports: [AsyncPipe, TuiButton],
})
export class FavoriteToggleButtonComponent implements OnChanges {
  @Input({ required: true }) type!: FavoriteKind;
  @Input() slug = '';
  @Input() targetId = '';
  @Input() iconOnly = false;
  @Input() appearance = 'secondary';
  readonly service = inject(MyFavoritesService);
  private readonly destroyRef = inject(DestroyRef);
  private pending?: Subscription;
  private generation = 0;
  private sessionVersion = -1;
  readonly state$ = this.service.myFavorites$;
  isFavorite$: Observable<boolean> = of(false);
  readonly error = signal('');
  readonly saving = signal(false);

  constructor() {
    this.state$.pipe(takeUntilDestroyed()).subscribe((state) => {
      if (state.sessionVersion === this.sessionVersion) return;
      this.sessionVersion = state.sessionVersion;
      this.invalidate();
    });
  }
  get identifier(): string {
    return this.service.mode === 'api' ? this.targetId : this.slug;
  }
  get supported(): boolean {
    return this.service.supports(this.type, this.identifier);
  }

  ngOnChanges(): void {
    this.invalidate();
    this.isFavorite$ = this.service.isFavorite$(this.type, this.identifier);
  }
  reload(): void {
    this.invalidate();
    this.service.reload();
  }
  toggleFavorite(isFavorite: boolean): void {
    const state = this.service.getState();
    if (
      !state.context ||
      state.isLoading ||
      state.isError ||
      state.isSaving ||
      this.saving()
    )
      return;
    const generation = this.generation;
    this.error.set('');
    this.saving.set(true);
    const operation = isFavorite
      ? this.service.removeFromFavorites(this.type, this.identifier)
      : this.service.addToFavorites(this.type, this.identifier);
    this.pending = operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (generation !== this.generation) return;
        this.saving.set(false);
        if (!result.ok) this.error.set(result.error.message);
      });
  }
  private invalidate(): void {
    this.generation++;
    this.pending?.unsubscribe();
    this.error.set('');
    this.saving.set(false);
  }
}
