import { ApplicationConfig } from '@angular/core';
import { OverviewApiService } from './infrastructure/overview-api.service';
import { OVERVIEW_PROVIDER } from './application/overview-providers.port';
import { OVERVIEW_API_URL } from './infrastructure/overview-api-url.port';

export function provideOverviewFeature(c?: { apiUrl?: string }): ApplicationConfig {
  return {
    providers: [
      { provide: OVERVIEW_API_URL, useValue: c?.apiUrl ?? '/api/overview' },
      { provide: OVERVIEW_PROVIDER, useClass: OverviewApiService }
    ]
  };
}
