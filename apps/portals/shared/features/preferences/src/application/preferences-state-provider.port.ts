import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { PreferencesState } from './preferences.state';

export interface IPreferencesStateProvider {
  state: Signal<PreferencesState>;
  isLoading: Signal<boolean>;
  isError: Signal<boolean>;
  preferences$: Observable<PreferencesState>;
}

