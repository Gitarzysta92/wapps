import { ChangeDetectionStrategy, Component, Type, inject, EventEmitter, InjectionToken, input } from '@angular/core';
import { RouterOutlet, RouterModule, ActivatedRoute, Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { filter, startWith, map, distinctUntilChanged, Observable, combineLatest } from 'rxjs';
import { AnimatedBackgroundComponent } from '@ui/intro-hero';

export interface IAppShellRouteData {
  header: Type<IAppShellHeaderComponent> | null;
  leftSidebar: {
    component: Type<IAppShellSidebarComponent>,
    inputs: Record<symbol, unknown>
  } | null
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

export const APP_SHELL_STATE_PROVIDER = new InjectionToken<IAppShellState>('APP_SHELL_STATE');


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
  private readonly _shellStateProvider = inject(APP_SHELL_STATE_PROVIDER);

  private readonly _routeData = this._router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    //INFO: startWith is used to ensure that the data is initialized, 
    //router outlet events don't emit a value on init
    startWith(null),
    map(() =>  this._route.firstChild?.snapshot as ActivatedRouteSnapshot)
  );



  public readonly headerComponent$ = this._routeData.pipe(
    map(s => s.data['header']),
    distinctUntilChanged()
  );

  public readonly leftSidebarComponent$ = combineLatest([
    this._routeData.pipe(
      distinctUntilChanged((p, c) => p.component === c.component)
    ),
    this._shellStateProvider.isLeftSidebarExpanded$
  ]).pipe(map(([s, isExpanded]) => ({
    component: (s.data as IAppShellRouteData).leftSidebar?.component,
    inputs: {
      ...(s.data as IAppShellRouteData).leftSidebar?.inputs,
      isExpanded,
      ...s.params
    }
  })))

  public readonly isLeftSidebarExpanded$ = this._shellStateProvider.isLeftSidebarExpanded$;

  public readonly rightSidebarComponent$ = this._routeData.pipe(
    map(s => s.data['rightSidebar']),
    distinctUntilChanged()
  );

  public readonly isRightSidebarExpanded$ = this._shellStateProvider.isRightSidebarExpanded$;

  public readonly footerComponent$ = this._routeData.pipe(
    map(s => s.data['footer']),
    distinctUntilChanged()
  );
  
}
