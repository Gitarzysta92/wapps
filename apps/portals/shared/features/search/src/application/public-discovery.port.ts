import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  PublicDiscoveryQuery,
  PublicDiscoveryResult,
} from '@domains/discovery';

export interface PublicDiscoveryPort {
  search(
    query: PublicDiscoveryQuery
  ): Observable<Result<PublicDiscoveryResult, Error>>;
}
export const PUBLIC_DISCOVERY = new InjectionToken<PublicDiscoveryPort>(
  'PUBLIC_DISCOVERY'
);
export const PUBLIC_DISCOVERY_URL = new InjectionToken<string>(
  'PUBLIC_DISCOVERY_URL'
);
