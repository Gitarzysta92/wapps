import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface GlobalState {
  isLoading: boolean;
  currentTheme: 'light' | 'dark';
}

export interface IAppShellState {
  isLeftSidebarExpanded$: Observable<boolean>;
  isRightSidebarExpanded$: Observable<boolean>;
  toggleLeftSidebar(): void;
  toggleRightSidebar(): void;
}

@Injectable()
export class GlobalStateService implements IAppShellState {
  private readonly _state = signal<GlobalState>({
    isLoading: false,
    currentTheme: 'light',
  });

  public readonly state = this._state.asReadonly();

  public readonly isLeftSidebarExpanded$ = new BehaviorSubject(false);
  public readonly isRightSidebarExpanded$ = new BehaviorSubject(false);

  public toggleLeftSidebar(): void {
    this.isLeftSidebarExpanded$.next(!this.isLeftSidebarExpanded$.value);
  }

  public toggleRightSidebar(): void {
    this.isRightSidebarExpanded$.next(!this.isRightSidebarExpanded$.value);
  }

  public setLoading(loading: boolean): void {
    this._state.update(current => ({ ...current, isLoading: loading }));
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this._state.update(current => ({ ...current, currentTheme: theme }));
  }
}
