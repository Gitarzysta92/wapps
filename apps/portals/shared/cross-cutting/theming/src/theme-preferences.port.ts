import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type ThemeSelection = 'light' | 'dark' | 'auto';

/** Keeps theming independent of a particular account/preferences feature. */
export interface ThemePreferencesPort {
  selection$: Observable<ThemeSelection>;
  save(selection: ThemeSelection): Observable<boolean>;
}

export const THEME_PREFERENCES = new InjectionToken<ThemePreferencesPort>('THEME_PREFERENCES');
