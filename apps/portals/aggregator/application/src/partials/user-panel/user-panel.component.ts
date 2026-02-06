import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiButton, TuiIcon } from "@taiga-ui/core";

import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from "@portals/cross-cutting/theming";
import { MyProfileNameComponent } from "@ui/my-profile";
import { MyProfileAvatarComponent } from "@ui/my-profile";
import { AuthenticationService } from "@portals/shared/features/identity";
import type { NavigationDeclaration } from "@ui/navigation";


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
  // WIP: Aggregator navigation wiring is outdated; keep panel minimal until re-aligned to aggregator-demo.
  public readonly navigationPrimary: NavigationDeclaration[] = [];
  public readonly navigationSecondary: NavigationDeclaration[] = [];
  public readonly theme = inject(THEME_PROVIDER_TOKEN); 
}