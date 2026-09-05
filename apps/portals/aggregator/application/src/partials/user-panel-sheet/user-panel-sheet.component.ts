import { AsyncPipe } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TuiButton, TuiDialogContext, TuiIcon } from "@taiga-ui/core";
import { injectContext } from "@taiga-ui/polymorpheus";
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN } from "@portals/cross-cutting/theming";
import { MyProfileNameComponent } from "@ui/my-profile";
import { MyProfileAvatarComponent } from "@ui/my-profile";
import { AuthenticationService } from "@portals/shared/features/identity";
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';

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
    ThemeToggleComponent,
    TuiButton,
    RouterLink,
    TuiIcon,
    MyProfileAvatarComponent,
    MyProfileNameComponent
  ],
})
export class UserPanelSheetComponent implements OnInit {
  public readonly context = injectContext<TuiDialogContext<unknown, UserPanelSheetContext>>();
  public readonly service = inject(AuthenticationService);
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  ngOnInit(): void {
    console.log(this.context?.data);
  }
}

