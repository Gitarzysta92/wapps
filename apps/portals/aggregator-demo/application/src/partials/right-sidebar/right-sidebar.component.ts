import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { AuthenticationService } from '@portals/shared/features/identity';
import { ThemeToggleComponent, THEME_PROVIDER_TOKEN, ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { MyProfileNameComponent, MyProfileAvatarComponent } from '@ui/my-profile';
import { IAppShellSidebarComponent } from '../../shells/app-shell/app-shell.component';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';

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

  @Input() isExpanded = false;
  @Input() navigationPrimary: NavigationDeclarationDto[] = [];
  @Input() navigationSecondary: NavigationDeclarationDto[] = [];
  @Output() toggleExpansion = new EventEmitter<void>();

  public readonly authService = inject(AuthenticationService, { optional: true });
  public readonly theme = inject(THEME_PROVIDER_TOKEN);

  public onToggleClick(): void {
    this.toggleExpansion.emit();
  }
}
