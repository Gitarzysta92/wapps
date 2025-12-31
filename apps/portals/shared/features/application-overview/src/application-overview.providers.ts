import { ApplicationConfig } from '@angular/core';
import { OverviewApiService } from './infrastructure/overview-api.service';
import { OverviewBffApiService } from './infrastructure/overview-bff-api.service';
import { APPLICATION_OVERVIEW_PROVIDER } from './application/overview-providers.port';
import { OVERVIEW_API_URL } from './infrastructure/overview-api-url.port';

export function provideApplicationOverviewFeature(c?: { apiUrl?: string; useBff?: boolean }): ApplicationConfig {
  const useRealApi = c?.useBff ?? true;
  
  return {
    providers: [
      { provide: OVERVIEW_API_URL, useValue: c?.apiUrl ?? '/api/overview' },
      { 
        provide: APPLICATION_OVERVIEW_PROVIDER, 
        useClass: useRealApi ? OverviewBffApiService : OverviewApiService 
      }
    ]
  };
}

