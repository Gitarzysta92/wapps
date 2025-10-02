import { ChangeDetectionStrategy, Component, OnInit, Type, inject, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { RouterOutlet, RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { NavigationService } from '@ui/navigation';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { filter, startWith, map, distinctUntilChanged } from 'rxjs';

export interface IAppShellRouteData {
  header: Type<IAppShellHeaderComponent> | null;
  leftSidebar: Type<IAppShellSidebarComponent> | null;
  rightSidebar: Type<IAppShellSidebarComponent> | null;
  footer: Type<unknown> | null;
}

export interface IAppShellHeaderComponent {
  showCollapseButton?: boolean;
  expandedStateChange?: EventEmitter<boolean>;
}

export interface IAppShellSidebarComponent {
  isExpanded: boolean;
}


@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  imports: [
    RouterOutlet,
    RouterModule,
    CommonModule,
    AsyncPipe,
    NgComponentOutlet,
  ],
  hostDirectives: [
    ThemingDescriptorDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent implements OnInit {

  private _route = inject(ActivatedRoute);
  private _router = inject(Router);

  private readonly _routeData = this._router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    //INFO: startWith is used to ensure that the data is initialized, 
    //router outlet events don't emit a value on init
    startWith(null),
    map(() => this._route.firstChild?.snapshot.data ?? {} as IAppShellRouteData)
  );

  public readonly headerComponent = this._routeData.pipe(
    map((data) => data['header']),
    distinctUntilChanged()
  );

  public readonly leftSidebarComponent = this._routeData.pipe(
    map((data) => data['leftSidebar']));

  public readonly rightSidebarComponent = this._routeData.pipe(
    map((data) => data['rightSidebar']));

  public readonly footerComponent = this._routeData.pipe(
    map((data) => data['footer']));

  private readonly navigationService = inject(NavigationService);

  ngOnInit(): void {
    // Component initialization if needed
  }

  public isSidebarExpanded = false;
  public isRightSidebarExpanded = false;
  public showCollapseButton = false;

  public toggleSidebarExpansion(): void {
    this.isSidebarExpanded = !this.isSidebarExpanded;
  }

  public toggleRightSidebarExpansion(): void {
    this.isRightSidebarExpanded = !this.isRightSidebarExpanded;
  }

  public onHeaderExpandedChange(_isExpanded: boolean): void {
    // Handle header expansion state changes if needed
  }

  public onSidebarClick(event: Event, side: 'left' | 'right'): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('expand-btn')) {
      event.stopPropagation();
      if (side === 'left') {
        this.toggleSidebarExpansion();
      } else {
        this.toggleRightSidebarExpansion();
      }
    }
  }
}
