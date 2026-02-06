import {
  ChangeDetectionStrategy,
  Component,
  Type,
  inject,
  InjectionToken,
  Signal,
} from '@angular/core';
import {
  RouterOutlet,
  RouterModule,
  ActivatedRoute,
  Router,
  NavigationEnd,
  ActivatedRouteSnapshot,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, startWith, map, Observable } from 'rxjs';
import { SafeComponentOutletDirective } from '@ui/misc';

export interface IAppShellRouteData {
  header?: {
    component: Type<unknown>;
    inputs?: Record<string, unknown | Signal<unknown>>;
  };
  footer?: {
    component: Type<unknown>;
    inputs?: Record<string, unknown | Signal<unknown>>;
  };
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
  imports: [RouterOutlet, RouterModule, CommonModule, SafeComponentOutletDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  private readonly _routeData = this._router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    startWith(null),
    map(() => {
      let current: ActivatedRouteSnapshot | null = this._route.snapshot;
      const aggregatedData: Record<string, unknown> = {};
      const aggregatedParams: Record<string, string> = {};
      while (current) {
        Object.assign(aggregatedData, current.data);
        Object.assign(aggregatedParams, current.params);
        current = current.firstChild;
      }
      return { data: aggregatedData, params: aggregatedParams };
    })
  );

  public readonly headerComponent$ = this._routeData.pipe(
    map((s) => ({
      component: (s.data as IAppShellRouteData)?.header?.component,
      inputs: { ...((s.data as IAppShellRouteData)?.header?.inputs ?? {}), ...s.params },
    }))
  );

  public readonly footerComponent$ = this._routeData.pipe(
    map((s) => ({
      component: (s.data as IAppShellRouteData)?.footer?.component,
      inputs: {
        ...((s.data as IAppShellRouteData)?.footer?.inputs ?? {}),
        ...s.params,
        ...s.data,
      },
    }))
  );
}

