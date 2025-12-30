import { ApplicationConfig } from '@angular/core';
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
      { provide: PREFERENCES_API_BASE_URL_PROVIDER, useValue: config.apiBaseUrl },
      { provide: CUSTOMER_PREFERENCES_PROVIDER, useClass: PreferencesApiService },
      { provide: CUSTOMER_PREFERENCES_UPDATER, useClass: PreferencesApiService },
      { provide: PREFERENCES_STATE_PROVIDER, useClass: PreferencesService },
    ]
  };
}

