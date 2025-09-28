import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { FooterPartialComponent } from '../../partials/footer/footer.component';
import { HeaderPartialComponent } from '../../partials/header/header.component';
import { NavigationService } from '@ui/navigation';
import { TuiButton } from '@taiga-ui/core';
import { TuiIcon } from '@taiga-ui/core';
import { CommonModule } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { MyProfileNameComponent, MyProfileAvatarComponent } from '@ui/my-profile';
import { AuthenticationService } from '@portals/shared/features/identity';
import { Menu } from '../../navigation';
// Removed sticky state directive imports - using out-of-viewport approach instead

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  imports: [
    RouterOutlet,
    RouterModule,
    HeaderPartialComponent,
    FooterPartialComponent,
    CommonModule,
    TuiButton,
    TuiIcon,
    AsyncPipe,
    ThemeToggleComponent,
    MyProfileAvatarComponent,
    MyProfileNameComponent
  ],
  hostDirectives: [
    ThemingDescriptorDirective
  ]
})
export class AppShellComponent implements OnInit {
  private readonly navigationService = inject(NavigationService);

  ngOnInit(): void {
    this.stickyTopOffset = this.height;
  }

  public height = 40;
  public stickyTopOffset = this.height;
  public isCollapsed = true;
  public isSidebarExpanded = false; // Start collapsed (icons only)
  public isRightSidebarExpanded = false; // Start collapsed (icons only)

  public get navigationItems() {
    const config = this.navigationService.config;
    return Object.values(config).filter(item => typeof item === 'object' && item !== null);
  }

  // User panel properties
  public readonly authService = inject(AuthenticationService, { optional: true });
  public readonly navigationPrimary = this.navigationService.getNavigationFor(Menu.UserPanelPrimary);
  public readonly navigationSecondary = this.navigationService.getNavigationFor(Menu.UserPanelSecondary);
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  public onHeaderExpandedChange(isExpanded: boolean): void {
    this.stickyTopOffset = isExpanded ? 0 : this.height;
    this.isCollapsed = !isExpanded;
  }

  // Old toggle methods removed - sidebar is always visible now

  public toggleSidebarExpansion(): void {
    this.isSidebarExpanded = !this.isSidebarExpanded;
  }

  public toggleRightSidebarExpansion(): void {
    this.isRightSidebarExpanded = !this.isRightSidebarExpanded;
  }
}
