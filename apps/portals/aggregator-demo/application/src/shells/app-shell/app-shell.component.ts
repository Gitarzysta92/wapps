import { ChangeDetectionStrategy, Component, Type, inject, EventEmitter, InjectionToken, Signal } from '@angular/core';
import { RouterOutlet, RouterModule, ActivatedRoute, Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { filter, startWith, map, distinctUntilChanged, Observable, combineLatest } from 'rxjs';
import { AnimatedBackgroundComponent } from '@ui/intro-hero';
import { SafeComponentOutletDirective } from '@ui/misc';
import { TuiIcon } from '@taiga-ui/core';

export interface IAppShellRouteData {
  topBar?: {
    component: Type<unknown>,
    inputs?: Record<symbol, unknown | Signal<unknown>>
  };
  header?: {
    component: Type<IAppShellHeaderComponent>,
    inputs?: Record<symbol, unknown | Signal<unknown>>
  };
  leftSidebar?: {
    component: Type<IAppShellSidebarComponent>,
    inputs?: Record<symbol, unknown | Signal<unknown>>
  }
  rightSidebar?: {
    component: Type<IAppShellSidebarComponent>,
    inputs?: Record<symbol, unknown | Signal<unknown>>
  };
  footer?: {
    component: Type<unknown>,
    inputs?: Record<symbol, unknown | Signal<unknown>>
  };
  bottomBar?: {
    component: Type<unknown>,
    inputs?: Record<symbol, unknown | Signal<unknown>>
  };
}

export interface IAppShellHeaderComponent {
  showCollapseButton?: boolean;
  expandedStateChange?: EventEmitter<boolean>;
}

export interface IAppShellSidebarComponent {
  isExpanded: Signal<boolean> | boolean;
}

export interface IAppShellState {
  toggleRightSidebar(): unknown;
  toggleLeftSidebar(): unknown;
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
    SafeComponentOutletDirective,
    AnimatedBackgroundComponent,
    TuiIcon
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

  public readonly topBarComponent$ = this._routeData.pipe(
    map(s => ({
      component: (s.data as IAppShellRouteData)?.topBar?.component,
      inputs: {
        ...((s.data as IAppShellRouteData) ?.topBar?.inputs ?? {}),
        ...s.params,
        ...s.data
      }
    }))
  );

  public readonly headerComponent$ = this._routeData.pipe(
    distinctUntilChanged((p, c) => p.component === c.component),
    map(s => ({
      component: (s.data as IAppShellRouteData)?.header?.component,
      inputs: {
        ...((s.data as IAppShellRouteData)  .header?.inputs ?? {}),
        ...s.params
      }
    }))
  );

  public readonly leftSidebarComponent$ = combineLatest([
    this._routeData,
    this._shellStateProvider.isLeftSidebarExpanded$
  ]).pipe(map(([s, isExpanded]) => ({
    component: (s.data as IAppShellRouteData)?.leftSidebar?.component,
    inputs: {
      // TODO: remove unnecessary fallback to empty object creation
      ...((s.data as IAppShellRouteData)?.leftSidebar?.inputs ?? {}),
      isExpanded,
      ...s.params,
      ...s.data
    }
  })))

  public readonly isLeftSidebarExpanded$ = this._shellStateProvider.isLeftSidebarExpanded$;

  public readonly rightSidebarComponent$ = combineLatest([
    this._routeData,
    this._shellStateProvider.isRightSidebarExpanded$
  ]).pipe(map(([s, isExpanded]) => ({
    component: (s.data as IAppShellRouteData)?.rightSidebar?.component,
    inputs: {
      ...((s.data as IAppShellRouteData)?.rightSidebar?.inputs ?? {}),
      isExpanded,
      ...s.params,
      ...s.data
    }
  })))

  public readonly isRightSidebarExpanded$ = this._shellStateProvider.isRightSidebarExpanded$;

  public readonly footerComponent$ = this._routeData.pipe(
    map(s => ({
      component: (s.data as IAppShellRouteData)?.footer?.component,
      inputs: {
        ...((s.data as IAppShellRouteData)?.footer?.inputs ?? {}),
        ...s.params,
        ...s.data
      }
    }))
  );

  public readonly bottomBarComponent$ = this._routeData.pipe(
    map(s => ({
      component: (s.data as IAppShellRouteData)?.bottomBar?.component,
      inputs: {
        ...((s.data as IAppShellRouteData)?.bottomBar?.inputs ?? {}),
        ...s.params,
        ...s.data
      }
    }))
  );


  public toggleLeftSidebar(): void {
    this._shellStateProvider.toggleLeftSidebar();
  }

  public toggleRightSidebar(): void {
    this._shellStateProvider.toggleRightSidebar();
  }
}
