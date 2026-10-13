import { Component, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { AuthenticationService } from '@portals/shared/features/identity';
import { THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { MyProfileNameComponent, MyProfileAvatarComponent } from '@ui/my-profile';
import { IAppShellSidebarComponent } from '../../shells/app-shell/app-shell.component';
import { NavigationDeclarationDto, buildRoutePath } from '@portals/shared/boundary/navigation';
import { RoutedDialogButton } from '@ui/routable-dialog';
import { MY_PROFILE_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { MyFavoritesGridComponent, FavoriteContentService } from '@portals/shared/features/my-favorites';
import { TAG_DICTIONARY } from '@portals/shared/data';
import { NAVIGATION } from '../../navigation';
import type { TagDto } from '@domains/catalog/tags';

@Component({
  selector: 'user-auxiliary-sidebar',
  templateUrl: './user-auxiliary-sidebar.component.html',
  styleUrl: './user-auxiliary-sidebar.component.scss',
  host: {
    '[class.expanded]': 'isExpanded'
  },
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink,
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
export class UserAuxiliarySidebarComponent implements IAppShellSidebarComponent {

  @Input() isExpanded = false;
  @Input() navigationPrimary: NavigationDeclarationDto[] = [];
  @Input() navigationSecondary: NavigationDeclarationDto[] = [];
  @Input() unauthenticatedNavigationPrimary: NavigationDeclarationDto[] = [];
  @Input() unauthenticatedNavigationSecondary: NavigationDeclarationDto[] = [];

  public readonly authService = inject(AuthenticationService, { optional: true });
  public readonly myProfileStateProvider = inject(MY_PROFILE_STATE_PROVIDER);
  public readonly favoritesContent = inject(FavoriteContentService);
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  public readonly myProfilePath = NAVIGATION.myProfile.path;
  
  public readonly myProfile$ = this.myProfileStateProvider.myProfile$;
  
  public readonly favoritesGridVm = computed(() => {
    const state = this.favoritesContent.view();
    const apps = state.items.filter(item => item.kind === 'applications');
    const items = apps.flatMap(item => item.slug === null ? [] : [{
      slug: item.slug,
      path: buildRoutePath(NAVIGATION.application.path, { appSlug: item.slug }, { absolute: true }),
      title: item.name,
      avatarUrl: item.image,
    }]);
    const hidden = apps.filter(item => item.status === 'hidden').length;
    return {
      items,
      hasItems: items.length > 0,
      isLoading: state.isLoading || state.contentLoading || state.preferencesLoading,
      isError: state.isError || state.contentError || state.preferencesError,
      preferencesError: state.preferencesError,
      hidden,
      unavailable: apps.length - items.length - hidden,
    };
  });

  // Curated tags to display
  public readonly curatedTags: TagDto[] = [
    TAG_DICTIONARY.ai,
    TAG_DICTIONARY.productivity,
    TAG_DICTIONARY.webDevelopment,
    TAG_DICTIONARY.cloud,
    TAG_DICTIONARY.social,
    TAG_DICTIONARY.education
  ];

  // Get current navigation based on authentication status
  public getCurrentNavigationPrimary(isAuthenticated: boolean | null): NavigationDeclarationDto[] {
    return isAuthenticated ? this.navigationPrimary : this.unauthenticatedNavigationPrimary;
  }

  public getCurrentNavigationSecondary(isAuthenticated: boolean | null): NavigationDeclarationDto[] {
    return isAuthenticated ? this.navigationSecondary : this.unauthenticatedNavigationSecondary;
  }
}
