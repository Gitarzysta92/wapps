import { InjectionToken } from '@angular/core';
import { IPreferencesStateProvider } from './preferences-state-provider.port';

export const PREFERENCES_STATE_PROVIDER = new InjectionToken<IPreferencesStateProvider>(
  'PREFERENCES_STATE_PROVIDER'
);


