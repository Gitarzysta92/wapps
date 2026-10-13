import { inject, type ApplicationConfig } from '@angular/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { PrivateSuitesService } from './application/private-suites.service';
import {
  PRIVATE_SUITES,
  SUITE_API_ORIGIN,
  SUITE_SESSION,
  type SuiteSession,
} from './application/private-suites.port';
import { PrivateSuitesApiService } from './infrastructure/private-suites-api.service';
import { SuitePublicationService } from './application/suite-publication.service';
import { SUITE_PUBLICATION } from './application/suite-publication.port';
import { SuitePublicationApiService } from './infrastructure/suite-publication-api.service';

export function providePrivateSuitesFeature(config: {
  mode: 'api' | 'demo';
  apiBaseUrl: string;
}): ApplicationConfig {
  if (
    !['api', 'demo'].includes(config.mode) ||
    typeof config.apiBaseUrl !== 'string'
  )
    throw new Error('Explicit suite mode and origin are required');
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
      throw new Error('Invalid suite service origin');
  }
  // Demo routes retain their explicitly local adapter; they cannot instantiate this workspace.
  if (config.mode === 'demo') return { providers: [] };
  return {
    providers: [
      PrivateSuitesService,
      SuitePublicationService,
      SuitePublicationApiService,
      { provide: SUITE_PUBLICATION, useExisting: SuitePublicationApiService },
      PrivateSuitesApiService,
      { provide: PRIVATE_SUITES, useExisting: PrivateSuitesApiService },
      {
        provide: SUITE_API_ORIGIN,
        useValue: config.apiBaseUrl.replace(/\/$/, ''),
      },
      {
        provide: SUITE_SESSION,
        useFactory: (): SuiteSession => {
          const session = inject(AUTHENTICATION_SESSION);
          return { key$: session.token$, currentKey: () => session.getToken() };
        },
      },
    ],
  };
}
