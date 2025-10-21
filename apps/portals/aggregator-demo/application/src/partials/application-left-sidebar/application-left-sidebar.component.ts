import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { map } from 'rxjs';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  section: string;
}

@Component({
  selector: 'application-left-sidebar',
  templateUrl: './application-left-sidebar.component.html',
  styleUrl: './application-left-sidebar.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TuiButton,
    TuiIcon
  ]
})
export class ApplicationLeftSidebarPartialComponent {
  private readonly _route = inject(ActivatedRoute);
  
  @Input() isExpanded = false;
  @Output() toggleExpansion = new EventEmitter<void>();

  // Get the app slug from route params to construct proper navigation links
  public readonly appSlug$ = this._route.paramMap.pipe(
    map(params => params.get('appSlug') ?? '1')
  );

  public readonly menuItems: MenuItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: '@tui.home',
      section: 'home'
    },
    {
      id: 'overview',
      label: 'Overview',
      icon: '@tui.box',
      section: 'overview'
    },
    {
      id: 'health',
      label: 'Health',
      icon: '@tui.heart-pulse',
      section: 'health'
    },
    {
      id: 'log',
      label: 'Dev Log',
      icon: '@tui.git-commit',
      section: 'log'
    },
    {
      id: 'review',
      label: 'Reviews',
      icon: '@tui.star',
      section: 'review'
    },
    {
      id: 'discussions',
      label: 'Discussions',
      icon: '@tui.message-circle',
      section: 'discussions'
    }
  ];

  public getNavigationPath(appSlug: string, section: string): string[] {
    // Special case: home redirects to the main home page
    if (section === 'home') {
      return ['/'];
    }
    return ['/app', appSlug, section];
  }
}

