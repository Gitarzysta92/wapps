import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { TuiIcon } from "@taiga-ui/core";
import { ThemeToggleComponent } from "../../../../../libs/aspects/theming/components/theme-toggle.component";
import { THEME_PROVIDER_TOKEN } from "../../../../../libs/aspects/theming/constants";
import { ThemingDescriptorDirective } from "../../../../../libs/aspects/theming/theming-descriptor.directive";
import { RoutedDialogButton } from "../../../../../libs/ui/directives/identity-routed-dialog-button.directive";


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