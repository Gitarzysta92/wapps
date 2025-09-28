import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiButton, TuiIcon } from "@taiga-ui/core";

import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from "@portals/cross-cutting/theming";
import { MyProfileNameComponent } from "@ui/my-profile";
import { NavigationService } from "@ui/navigation";
import { MyProfileAvatarComponent } from "@ui/my-profile";
import { Menu } from "../../navigation";
import { AuthenticationService } from "@portals/shared/features/identity";


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