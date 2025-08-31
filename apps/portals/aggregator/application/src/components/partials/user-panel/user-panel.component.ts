import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiButton, TuiIcon } from "@taiga-ui/core";
import { NavigationService } from "@portals/shared/cross-cutting/navigation";
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from "@portals/shared/cross-cutting/theming";
import { Menu } from "@portals/shared/features/navigation";
import { MyProfileAvatarComponent, MyProfileNameComponent } from "@ui/my-profile";


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