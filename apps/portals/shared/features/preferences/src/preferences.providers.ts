import { inject, type ApplicationConfig } from '@angular/core';
import { map, of } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  THEME_PREFERENCES,
  type ThemePreferencesPort,
} from '@portals/cross-cutting/theming';
import { PreferencesApiService } from './infrastructure/preferences-api.service';
import { PreferencesDemoService } from './infrastructure/preferences-demo.service';
import { GuestPreferencesService } from './infrastructure/guest-preferences.service';
import { PreferencesService } from './application/preferences.service';
import { PREFERENCES_STATE_PROVIDER } from './application/preferences-state-provider.token';
import { PREFERENCES_API_BASE_URL_PROVIDER } from './application/infrastructure-providers.port';
import {
  PREFERENCES_MODE,
  PREFERENCES_PORT,
  GUEST_PREFERENCES_PORT,
  PREFERENCES_SESSION,
  type PreferencesSession,
} from './application/preferences-session.port';

export function providePreferencesFeature(config: {
  mode: 'api' | 'demo';
  apiBaseUrl: string;
}): ApplicationConfig {
  if (
    !['api', 'demo'].includes(config.mode) ||
    typeof config.apiBaseUrl !== 'string'
  )
    throw new Error(
      'Preferences mode and API origin must be explicitly configured'
    );
  if (config.apiBaseUrl) {
    const url = new URL(config.apiBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid preferences API origin');
  }
  const adapter =
    config.mode === 'api' ? PreferencesApiService : PreferencesDemoService;
  return {
    providers: [
      adapter,
      GuestPreferencesService,
      PreferencesService,
      { provide: PREFERENCES_MODE, useValue: config.mode },
      { provide: PREFERENCES_PORT, useExisting: adapter },
      { provide: GUEST_PREFERENCES_PORT, useExisting: GuestPreferencesService },
      {
        provide: PREFERENCES_SESSION,
        useFactory: (): PreferencesSession => {
          if (config.mode === 'demo')
            return { key$: of('demo'), currentKey: () => 'demo' };
          const session = inject(AUTHENTICATION_SESSION);
          return { key$: session.token$, currentKey: () => session.getToken() };
        },
      },
      {
        provide: PREFERENCES_API_BASE_URL_PROVIDER,
        useValue: config.apiBaseUrl.replace(/\/$/, ''),
      },
      { provide: PREFERENCES_STATE_PROVIDER, useExisting: PreferencesService },
      {
        provide: THEME_PREFERENCES,
        useFactory: (): ThemePreferencesPort => {
          const preferences = inject(PreferencesService);
          return {
            selection$: preferences.preferences$.pipe(
              map((state) => state.data.display.theme)
            ),
            save: (theme) =>
              preferences
                .updateDisplayPreferences({ theme })
                .pipe(map((result) => result.ok && result.value)),
          };
        },
      },
    ],
  };
}
