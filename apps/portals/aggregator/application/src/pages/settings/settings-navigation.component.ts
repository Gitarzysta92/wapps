import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { TuiButton, TuiDataList, TuiDropdown, TuiIcon } from '@taiga-ui/core';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { SETTINGS_NAVIGATION } from '../../navigation';

@Component({
  selector: 'settings-navigation',
  imports: [RouterLink, RouterLinkActive, TuiButton, TuiDataList, TuiDropdown, TuiIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './settings-navigation.component.scss',
  template: `
    <button tuiButton type="button" appearance="secondary" size="s" iconEnd="@tui.chevron-down"
      [attr.aria-label]="'Settings section: ' + current().label" [attr.aria-expanded]="open"
      [tuiDropdown]="sections" [(tuiDropdownOpen)]="open">
      {{ current().label }}
    </button>
    <ng-template #sections>
      <nav aria-label="Settings sections">
        <tui-data-list size="m">
          @for (item of navigation; track item.path) {
            <a tuiOption new [routerLink]="'/' + item.path" routerLinkActive #active="routerLinkActive"
              ariaCurrentWhenActive="page" (click)="open = false">
              <tui-icon [icon]="item.icon" />
              {{ item.label }}
              @if (active.isActive) { <tui-icon icon="@tui.check" /> }
            </a>
          }
        </tui-data-list>
      </nav>
    </ng-template>
  `,
})
export class SettingsNavigationComponent {
  readonly navigation = SETTINGS_NAVIGATION;
  private readonly data = toSignal(inject(ActivatedRoute).data, { requireSync: true });
  readonly current = computed(() => {
    const breadcrumbs = this.data()['breadcrumb'] as NavigationDeclarationDto[] | undefined;
    return breadcrumbs?.[breadcrumbs.length - 1] ?? this.navigation[0];
  });
  open = false;
}
