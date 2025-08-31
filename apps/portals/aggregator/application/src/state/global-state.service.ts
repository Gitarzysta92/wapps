import { Injectable, signal } from '@angular/core';

export interface GlobalState {
  isLoading: boolean;
  currentTheme: 'light' | 'dark';
  userPreferences: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalStateService {
  private readonly _state = signal<GlobalState>({
    isLoading: false,
    currentTheme: 'light',
    userPreferences: {}
  });

  public readonly state = this._state.asReadonly();

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
}
