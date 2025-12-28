import { ApplicationConfig } from '@angular/core';
import { OverviewApiService } from './infrastructure/overview-api.service';
import { APPLICATION_OVERVIEW_PROVIDER } from './application/overview-providers.port';
import { OVERVIEW_API_URL } from './infrastructure/overview-api-url.port';

export function provideApplicationOverviewFeature(c?: { apiUrl?: string }): ApplicationConfig {
  return {
    providers: [
      { provide: OVERVIEW_API_URL, useValue: c?.apiUrl ?? '/api/overview' },
      { provide: APPLICATION_OVERVIEW_PROVIDER, useClass: OverviewApiService }
    ]
  };
}

