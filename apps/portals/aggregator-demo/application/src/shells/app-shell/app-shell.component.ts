import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { FooterPartialComponent } from '../../partials/footer/footer.component';
import { HeaderPartialComponent } from '../../partials/header/header.component';
import { NavigationService } from '@ui/navigation';
import { TuiButton } from '@taiga-ui/core';
import { TuiIcon } from '@taiga-ui/core';
import { CommonModule } from '@angular/common';
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
    TuiIcon
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

  public get navigationItems() {
    const config = this.navigationService.config;
    return Object.values(config).filter(item => typeof item === 'object' && item !== null);
  }

  public onHeaderExpandedChange(isExpanded: boolean): void {
    this.stickyTopOffset = isExpanded ? 0 : this.height;
    this.isCollapsed = !isExpanded;
  }

  // Old toggle methods removed - sidebar is always visible now

  public toggleSidebarExpansion(): void {
    this.isSidebarExpanded = !this.isSidebarExpanded;
  }
}
