import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiButton, TuiIcon } from "@taiga-ui/core";
import { NavigationService } from "../../../../../libs/aspects/navigation";
import { ThemeToggleComponent } from "../../../../../libs/aspects/theming/components/theme-toggle.component";
import { THEME_PROVIDER_TOKEN } from "../../../../../libs/aspects/theming/constants";
import { ThemingDescriptorDirective } from "../../../../../libs/aspects/theming/theming-descriptor.directive";
import { Menu } from "applications/web-client/navigation";
import { AuthenticationService } from "../../../../../libs/aspects/authentication/application";
import { MyProfileAvatarComponent } from "../../../../../libs/features/my-profile/presentation/containers/my-profile-avatar";
import { MyProfileNameComponent } from "../../../../../libs/features/my-profile/presentation/containers/my-profile-name";


@Component({
  selector: 'user-panel',
  templateUrl: "user-panel.component.html",
  styleUrl: 'user-panel.component.scss',
  standalone: true,
  hostDirectives: [
    ThemingDescriptorDirective
  ],
  imports: [
    AsyncPipe,
    ThemeToggleComponent,
    TuiButton,
    RouterLink,
    TuiIcon,
    MyProfileAvatarComponent,
    MyProfileNameComponent
  ],
})
export class UserPanelComponent {
  public readonly service = inject(AuthenticationService);
  private readonly _navigationService = inject(NavigationService);
  public readonly navigationPrimary = this._navigationService.getNavigationFor(Menu.UserPanelPrimary);
  public readonly navigationSecondary = this._navigationService.getNavigationFor(Menu.UserPanelSecondary);
  public readonly theme = inject(THEME_PROVIDER_TOKEN); 
}