import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { NavigationService } from '@ui/navigation';
import { Menu } from '../../navigation';

@Component({
  selector: 'left-sidebar',
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon
  ]
})
export class LeftSidebarPartialComponent {
  private readonly navigationService = inject(NavigationService);

  @Input() isExpanded = false;
  @Output() toggleExpansion = new EventEmitter<void>();

  public get navigationItems() {
    const config = this.navigationService.config;
    const allItems = Object.values(config).filter(item => typeof item === 'object' && item !== null);
    
    // Exclude items that appear in user panels
    const userPanelIds = new Set<number>([
      ...this.navigationService.getNavigationFor(Menu.UserPanelPrimary).map(i => i.id),
      ...this.navigationService.getNavigationFor(Menu.UserPanelSecondary).map(i => i.id)
    ]);
    
    return allItems.filter(i => !userPanelIds.has(i.id));
  }

  public onToggleClick(): void {
    this.toggleExpansion.emit();
  }
}
