import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from "@portals/cross-cutting/theming";
import { RoutedDialogButton } from "@ui/routable-dialog";


@Component({
  selector: 'guest-panel',
  templateUrl: "guest-panel.component.html",
  styleUrl: 'guest-panel.component.scss',
  standalone: true,
  hostDirectives: [
    ThemingDescriptorDirective
  ],
  imports: [
    AsyncPipe,
    ThemeToggleComponent,
    RoutedDialogButton,
    TuiIcon,
  ],
})
export class GuestPanelComponent {
    public readonly theme = inject(THEME_PROVIDER_TOKEN); 
}