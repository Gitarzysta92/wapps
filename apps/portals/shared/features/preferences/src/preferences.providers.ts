import { map } from 'rxjs';
import { THEME_PREFERENCES, ThemePreferencesPort } from '@portals/cross-cutting/theming';
import { inject, ApplicationConfig } from '@angular/core';
import { 
  CUSTOMER_PREFERENCES_PROVIDER, 
  CUSTOMER_PREFERENCES_UPDATER 
} from '@domains/customer/preferences';
import { PreferencesApiService } from './infrastructure/preferences-api.service';
import { PreferencesService } from './application/preferences.service';
import { PREFERENCES_STATE_PROVIDER } from './application/preferences-state-provider.token';
import { PREFERENCES_API_BASE_URL_PROVIDER } from './application/infrastructure-providers.port';

export function providePreferencesFeature(config: {
  apiBaseUrl: string;
}): ApplicationConfig {
  return {
    providers: [
      PreferencesApiService,
      PreferencesService,
      {
        provide: THEME_PREFERENCES,
        useFactory: (): ThemePreferencesPort => {
          const preferences = inject(PreferencesService);
          return {
            selection$: preferences.preferences$.pipe(map(state => state.data.display.theme)),
            save: theme => preferences.updateDisplayPreferences({ theme }).pipe(map(result => result.ok && result.value))
          };
        }
      },
      { provide: PREFERENCES_API_BASE_URL_PROVIDER, useValue: config.apiBaseUrl },
      { provide: CUSTOMER_PREFERENCES_PROVIDER, useExisting: PreferencesApiService },
      { provide: CUSTOMER_PREFERENCES_UPDATER, useExisting: PreferencesApiService },
      { provide: PREFERENCES_STATE_PROVIDER, useExisting: PreferencesService },
    ]
  };
}


