import { mergeApplicationConfig } from '@angular/core';
import { GlobalStateService } from './state/global-state.service';
import { APP_SHELL_STATE_PROVIDER } from './shells/app-shell/app-shell.component';
import { CATALOG_API_BASE_URL } from './environment';
import { CATALOG_API_URL } from './services/catalog-api-url.token';

export const APPLICATION_ROOT = mergeApplicationConfig(
  {
    providers: [
      GlobalStateService,
      { provide: APP_SHELL_STATE_PROVIDER, useExisting: GlobalStateService },
      { provide: CATALOG_API_URL, useValue: CATALOG_API_BASE_URL },
    ]
  }
);
