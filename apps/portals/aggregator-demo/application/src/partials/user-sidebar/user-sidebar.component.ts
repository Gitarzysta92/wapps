import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { AuthenticationService } from '@portals/shared/features/identity';
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { MyProfileNameComponent, MyProfileAvatarComponent } from '@ui/my-profile';
import { IAppShellSidebarComponent } from '../../shells/app-shell/app-shell.component';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { RoutedDialogButton } from '@ui/routable-dialog';

@Component({
  selector: 'user-sidebar',
  templateUrl: './user-sidebar.component.html',
  styleUrl: './user-sidebar.component.scss',
  host: {
    '[class.expanded]': 'isExpanded'
  },
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon,
    MyProfileAvatarComponent,
    MyProfileNameComponent,
    RoutedDialogButton
  ],
  hostDirectives: [
    ThemingDescriptorDirective
  ]
})
export class UserSidebarPartialComponent implements IAppShellSidebarComponent {

  @Input() isExpanded = false;
  @Input() navigationPrimary: NavigationDeclarationDto[] = [];
  @Input() navigationSecondary: NavigationDeclarationDto[] = [];
  @Input() unauthenticatedNavigationPrimary: NavigationDeclarationDto[] = [];
  @Input() unauthenticatedNavigationSecondary: NavigationDeclarationDto[] = [];

  public readonly authService = inject(AuthenticationService, { optional: true });
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  // Get current navigation based on authentication status
  public getCurrentNavigationPrimary(isAuthenticated: boolean | null): NavigationDeclarationDto[] {
    return isAuthenticated ? this.navigationPrimary : this.unauthenticatedNavigationPrimary;
  }

  public getCurrentNavigationSecondary(isAuthenticated: boolean | null): NavigationDeclarationDto[] {
    return isAuthenticated ? this.navigationSecondary : this.unauthenticatedNavigationSecondary;
  }
}

