import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { AuthenticationService } from '@portals/shared/features/identity';
import { THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { MyProfileNameComponent, MyProfileAvatarComponent } from '@ui/my-profile';
import { IAppShellSidebarComponent } from '../../shells/app-shell/app-shell.component';
import { NavigationDeclarationDto, buildRoutePath } from '@portals/shared/boundary/navigation';
import { RoutedDialogButton } from '@ui/routable-dialog';
import { MY_PROFILE_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { MyFavoritesGridComponent, MY_FAVORITES_STATE_PROVIDER, type MyFavoritesGridViewModel } from '@portals/shared/features/my-favorites';
import { APPLICATIONS } from '@portals/shared/data';
import { NAVIGATION } from '../../navigation';
import { map } from 'rxjs';

@Component({
  selector: 'user-common-sidebar',
  templateUrl: './user-common-sidebar.component.html',
  styleUrl: './user-common-sidebar.component.scss',
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
    RoutedDialogButton,
    MyFavoritesGridComponent
  ],
  hostDirectives: [
    ThemingDescriptorDirective
  ]
})
export class UserCommonSidebarPartialComponent implements IAppShellSidebarComponent {

  @Input() isExpanded = false;
  @Input() navigationPrimary: NavigationDeclarationDto[] = [];
  @Input() navigationSecondary: NavigationDeclarationDto[] = [];
  @Input() unauthenticatedNavigationPrimary: NavigationDeclarationDto[] = [];
  @Input() unauthenticatedNavigationSecondary: NavigationDeclarationDto[] = [];

  public readonly authService = inject(AuthenticationService, { optional: true });
  public readonly myProfileStateProvider = inject(MY_PROFILE_STATE_PROVIDER);
  public readonly myFavoritesStateProvider = inject(MY_FAVORITES_STATE_PROVIDER);
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  public readonly myProfile$ = this.myProfileStateProvider.myProfile$;
  
  public readonly favoritesGridVm$ = this.myFavoritesStateProvider.myFavorites$.pipe(
    map(state => ({
      items: state.data.applications.map(slug => {
        const app = APPLICATIONS.find(a => a.slug === slug);
        return {
          slug,
          path: buildRoutePath(NAVIGATION.application.path, { appSlug: slug }),
          title: app?.name || slug,
          avatarUrl: app?.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${slug}`
        };
      }),
      hasItems: state.data.applications.length > 0
    } as MyFavoritesGridViewModel))
  );

  // Get current navigation based on authentication status
  public getCurrentNavigationPrimary(isAuthenticated: boolean | null): NavigationDeclarationDto[] {
    return isAuthenticated ? this.navigationPrimary : this.unauthenticatedNavigationPrimary;
  }

  public getCurrentNavigationSecondary(isAuthenticated: boolean | null): NavigationDeclarationDto[] {
    return isAuthenticated ? this.navigationSecondary : this.unauthenticatedNavigationSecondary;
  }
}

