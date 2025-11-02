import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon, TuiIconPipe } from '@taiga-ui/core';
import { TuiAvatar } from '@taiga-ui/kit';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';

@Component({
  selector: 'left-sidebar',
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon,
    TuiAvatar,
    TuiIconPipe
  ]
})
export class LeftSidebarPartialComponent {

  @Input() isExpanded = false;
  @Input() navigation: NavigationDeclarationDto[] = [];
  @Output() toggleExpansion = new EventEmitter<void>();

  public getRouterLinkActiveOptions(path: string): { exact: boolean } {
    // Use exact matching for home route (empty path) to avoid matching all routes
    return { exact: path === '' };
  }

  public onToggleClick(): void {
    this.toggleExpansion.emit();
  }
}
