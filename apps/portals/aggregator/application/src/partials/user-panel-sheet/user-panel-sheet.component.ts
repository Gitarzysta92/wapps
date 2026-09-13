import { AsyncPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink, Router } from "@angular/router";
import { TuiButton, TuiDialogContext } from "@taiga-ui/core";
import { injectContext } from "@taiga-ui/polymorpheus";
import { THEME_PROVIDER_TOKEN } from "@portals/cross-cutting/theming";
import { MyProfileNameComponent } from "@ui/my-profile";
import { MyProfileAvatarComponent } from "@ui/my-profile";
import { AuthenticationService } from "@portals/shared/features/identity";
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { AUTHENTICATED_USER_MAIN_NAVIGATION, AUTHENTICATED_USER_SECONDARY_NAVIGATION } from '../../navigation';
import { MY_PROFILE_STATE_PROVIDER } from '@portals/shared/features/my-profile';

interface UserPanelSheetContext {
  navigationPrimary: NavigationDeclarationDto[];
  navigationSecondary: NavigationDeclarationDto[];
  unauthenticatedNavigationPrimary: NavigationDeclarationDto[];
  unauthenticatedNavigationSecondary: NavigationDeclarationDto[];
}

@Component({
  selector: 'user-panel-sheet',
  templateUrl: "user-panel-sheet.component.html",
  styleUrl: 'user-panel-sheet.component.scss',
  standalone: true,
  imports: [
    AsyncPipe,
    TuiButton,
    RouterLink,
    MyProfileAvatarComponent,
    MyProfileNameComponent
  ],
})
export class UserPanelSheetComponent  {
  public readonly context = injectContext<TuiDialogContext<unknown, UserPanelSheetContext>>();
  public readonly service = inject(AuthenticationService);
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  readonly profile$ = inject(MY_PROFILE_STATE_PROVIDER).myProfile$;
  readonly primary = this.context.data?.navigationPrimary ?? AUTHENTICATED_USER_MAIN_NAVIGATION;
  readonly secondary = this.context.data?.navigationSecondary ?? AUTHENTICATED_USER_SECONDARY_NAVIGATION;
  private readonly router = inject(Router);

  close(): void { this.context.completeWith(undefined); }
  login(): void {
    this.close();
    void this.router.navigate([{ outlets: { dialog: 'identity' } }]);
  }
}
