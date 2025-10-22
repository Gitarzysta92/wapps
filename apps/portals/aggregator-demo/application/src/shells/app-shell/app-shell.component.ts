import { ChangeDetectionStrategy, Component, Type, inject, EventEmitter, InjectionToken } from '@angular/core';
import { RouterOutlet, RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { filter, startWith, map, distinctUntilChanged, Observable } from 'rxjs';
import { AnimatedBackgroundComponent } from '@ui/intro-hero';

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

export interface IAppShellState {
  isLeftSidebarExpanded$: Observable<boolean>;
  isRightSidebarExpanded$: Observable<boolean>;
}

export const APP_SHELL_STATE = new InjectionToken<IAppShellState>('APP_SHELL_STATE');


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
    AnimatedBackgroundComponent,
  ],
  hostDirectives: [
    ThemingDescriptorDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _shellState = inject(APP_SHELL_STATE);

  private readonly _routeData = this._router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    //INFO: startWith is used to ensure that the data is initialized, 
    //router outlet events don't emit a value on init
    startWith(null),
    map(() => this._route.firstChild?.snapshot.data ?? {} as IAppShellRouteData)
  );

  public readonly headerComponent$ = this._routeData.pipe(
    map((data) => data['header']),
    distinctUntilChanged()
  );

  public readonly leftSidebarComponent$ = this._routeData.pipe(
    map((data) => data['leftSidebar']),
    distinctUntilChanged()
  );

  public readonly isLeftSidebarExpanded$ = this._shellState.isLeftSidebarExpanded$;

  public readonly rightSidebarComponent$ = this._routeData.pipe(
    map((data) => data['rightSidebar']),
    distinctUntilChanged()
  );

  public readonly isRightSidebarExpanded$ = this._shellState.isRightSidebarExpanded$;

  public readonly footerComponent$ = this._routeData.pipe(
    map((data) => data['footer']),
    distinctUntilChanged()
  );
}
