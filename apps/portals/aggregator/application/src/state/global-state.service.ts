import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface GlobalState {
  isLoading: boolean;
  currentTheme: 'light' | 'dark';
  userPreferences: Record<string, any>;
  userPanelOpen: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalStateService {
  private readonly _state = signal<GlobalState>({
    isLoading: false,
    currentTheme: 'light',
    userPreferences: {},
    userPanelOpen: false
  });

  private readonly _userPanelOpen$ = new BehaviorSubject<boolean>(false);

  public readonly state = this._state.asReadonly();
  public readonly userPanelOpen$ = this._userPanelOpen$.asObservable();

  public setLoading(loading: boolean): void {
    this._state.update(current => ({ ...current, isLoading: loading }));
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this._state.update(current => ({ ...current, currentTheme: theme }));
  }

  public setUserPreference(key: string, value: any): void {
    this._state.update(current => ({
      ...current,
      userPreferences: { ...current.userPreferences, [key]: value }
    }));
  }

  public getUserPreference(key: string): any {
    return this._state().userPreferences[key];
  }

  public toggleUserPanel(): void {
    const current = this._userPanelOpen$.value;
    this._userPanelOpen$.next(!current);
    this._state.update(current => ({ ...current, userPanelOpen: !current }));
  }

  public closeUserPanel(): void {
    this._userPanelOpen$.next(false);
    this._state.update(current => ({ ...current, userPanelOpen: false }));
  }
}
