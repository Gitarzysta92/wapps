import { ChangeDetectionStrategy, Component, Type, inject, EventEmitter, InjectionToken } from '@angular/core';
import { RouterOutlet, RouterModule, ActivatedRoute, Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AsyncPipe } from '@angular/common';
import { ThemingDescriptorDirective } from '@portals/cross-cutting/theming';
import { filter, startWith, map, distinctUntilChanged, Observable, combineLatest } from 'rxjs';
import { AnimatedBackgroundComponent } from '@ui/intro-hero';
import { SafeComponentOutletDirective } from '@ui/misc';

export interface IAppShellRouteData {
  header: {
    component: Type<IAppShellHeaderComponent>,
    inputs?: Record<symbol, unknown>
  } | null;
  leftSidebar: {
    component: Type<IAppShellSidebarComponent>,
    inputs?: Record<symbol, unknown>
  } | null
  rightSidebar: {
    component: Type<IAppShellSidebarComponent>,
    inputs?: Record<symbol, unknown>
  } | null;
  footer: {
    component: Type<unknown>,
    inputs?: Record<symbol, unknown>
  } | null;
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
    SafeComponentOutletDirective,
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
    distinctUntilChanged((p, c) => p.component === c.component),
    map(s => ({
      component: (s.data as IAppShellRouteData).header?.component,
      inputs: {
        ...((s.data as IAppShellRouteData).header?.inputs ?? {}),
        ...s.params
      }
    }))
  );

  public readonly leftSidebarComponent$ = combineLatest([
    this._routeData.pipe(
      distinctUntilChanged((p, c) => p.component === c.component)
    ),
    this._shellStateProvider.isLeftSidebarExpanded$
  ]).pipe(map(([s, isExpanded]) => ({
    component: (s.data as IAppShellRouteData).leftSidebar?.component,
    inputs: {
      // TODO: remove unnecessary fallback to empty object creation
      ...((s.data as IAppShellRouteData).leftSidebar?.inputs ?? {}),
      isExpanded,
      ...s.params
    }
  })))

  public readonly isLeftSidebarExpanded$ = this._shellStateProvider.isLeftSidebarExpanded$;

  public readonly rightSidebarComponent$ = combineLatest([
    this._routeData.pipe(
      distinctUntilChanged((p, c) => p.component === c.component)
    ),
    this._shellStateProvider.isRightSidebarExpanded$
  ]).pipe(map(([s, isExpanded]) => ({
    component: (s.data as IAppShellRouteData).rightSidebar?.component,
    inputs: {
      ...((s.data as IAppShellRouteData).rightSidebar?.inputs ?? {}),
      isExpanded,
      ...s.params
    }
  })))

  public readonly isRightSidebarExpanded$ = this._shellStateProvider.isRightSidebarExpanded$;

  public readonly footerComponent$ = this._routeData.pipe(
    distinctUntilChanged((p, c) => p.component === c.component),
    map(s => ({
      component: (s.data as IAppShellRouteData).footer?.component,
      inputs: {
        ...(s.data as IAppShellRouteData).footer?.inputs,
        ...s.params
      }
    }))
  );
  
}
