import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NavigationService } from '@ui/navigation';
import { Menu } from '../../navigation';
import { AuthenticationService } from '@portals/shared/features/identity';
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { MyProfileNameComponent, MyProfileAvatarComponent } from '@ui/my-profile';
import { IAppShellSidebarComponent } from '../../shells/app-shell/app-shell.component';

@Component({
  selector: 'right-sidebar',
  templateUrl: './right-sidebar.component.html',
  styleUrl: './right-sidebar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon,
    ThemeToggleComponent,
    MyProfileAvatarComponent,
    MyProfileNameComponent
  ],
  hostDirectives: [
    ThemingDescriptorDirective
  ]
})
export class RightSidebarPartialComponent implements IAppShellSidebarComponent {
  private readonly navigationService = inject(NavigationService);
  public readonly authService = inject(AuthenticationService, { optional: true });
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  @Input() isExpanded = false;
  @Output() toggleExpansion = new EventEmitter<void>();

  public readonly navigationPrimary = this.navigationService.getNavigationFor(Menu.UserPanelPrimary);
  public readonly navigationSecondary = this.navigationService.getNavigationFor(Menu.UserPanelSecondary);

  public onToggleClick(): void {
    this.toggleExpansion.emit();
  }
}
