import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
import { SETTINGS_NAVIGATION } from '../../navigation';

@Component({
  selector: 'settings-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './settings-navigation.component.scss',
  template: `
    <nav aria-label="Settings sections">
      @for (item of navigation; track item.path) {
        <a #link tuiButton size="s" [appearance]="active.isActive ? 'primary' : 'secondary'"
          [routerLink]="'/' + item.path" routerLinkActive #active="routerLinkActive"
          ariaCurrentWhenActive="page" (isActiveChange)="$event && reveal(link)">
          {{ item.label }}
        </a>
      }
    </nav>
  `,
})
export class SettingsNavigationComponent {
  readonly navigation = SETTINGS_NAVIGATION;

  reveal(link: HTMLElement): void {
    const nav = link.parentElement!;
    // Scroll only the tab row, leaving the page's scroll restoration alone.
    nav.scrollLeft = Math.max(0, link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2);
  }
}
