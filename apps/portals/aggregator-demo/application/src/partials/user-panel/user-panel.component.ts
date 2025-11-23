import { AsyncPipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiButton, TuiIcon } from "@taiga-ui/core"
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN } from "@portals/cross-cutting/theming";
import { MyProfileNameComponent } from "@ui/my-profile";
import { MyProfileAvatarComponent } from "@ui/my-profile";
import { AuthenticationService } from "@portals/shared/features/identity";


@Component({
  selector: 'user-panel',
  templateUrl: "user-panel.component.html",
  styleUrl: 'user-panel.component.scss',
  standalone: true,
  hostDirectives: [
    // ThemingDescriptorDirective,
    // TuiSheetDialog
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
  public readonly open = signal(false);
  public readonly service = inject(AuthenticationService);
 // private readonly _navigationService = inject(NavigationService);
  public readonly navigationPrimary: any[] = [];
  public readonly navigationSecondary: any[] = [];
  public readonly theme = inject(THEME_PROVIDER_TOKEN); 
}