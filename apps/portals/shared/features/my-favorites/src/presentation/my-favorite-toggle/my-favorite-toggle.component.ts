import { Component, input, HostListener, HostBinding } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TuiIcon } from '@taiga-ui/core';

export type FavoriteItemType = 'app' | 'suite';

export interface FavoriteItem {
  id: string;
  type?: FavoriteItemType;
}

@Component({
  selector: 'my-favorite-toggle',
  standalone: true,
  imports: [TuiIcon],
  hostDirectives: [TuiButton],
  templateUrl: './my-favorite-toggle.component.html',
  styleUrl: './my-favorite-toggle.component.scss',
  host: {
    'type': 'button',
  }
})
export class MyFavoriteToggleComponent {
  item = input.required<FavoriteItem | string>();
  readonly = input<boolean>(false);
  isFavorite = input<boolean>(false);
  size = input<"s" | "m" | "l" | "xl" | "xs">('s');

  @HostBinding('disabled')
  get isDisabled(): boolean {
    return this.readonly();
  }
  
  protected get itemId(): string {
    const item = this.item();
    return typeof item === 'string' ? item : item.id;
  }
  
  @HostListener('click')
  protected toggleFavorite(): void {
    if (this.readonly()) {
      return;
    }
    // TODO: Implement favorite toggle logic
    console.log('Toggle favorite for:', this.itemId);
  }
}


