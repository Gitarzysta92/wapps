import { mergeApplicationConfig } from '@angular/core';
import { provideIdentityLoginFeature, provideIdentityManagementFeature } from '@portals/shared/features/identity';
import { LOGIN_VALIDATION_MESSAGES } from '@portals/shared/data';
import { GlobalStateService } from './state/global-state.service';
import { APP_SHELL_STATE_PROVIDER } from './shells/app-shell/app-shell.component';
import { AUTH_BFF_URL } from './environment';

export const APPLICATION_ROOT = mergeApplicationConfig(
  provideIdentityLoginFeature({
    validationMessages: LOGIN_VALIDATION_MESSAGES,
    authBffUrl: AUTH_BFF_URL || undefined,
  }),
  provideIdentityManagementFeature(),
  {
    providers: [
      GlobalStateService,
      { provide: APP_SHELL_STATE_PROVIDER, useExisting: GlobalStateService },
    ],
  }
);

