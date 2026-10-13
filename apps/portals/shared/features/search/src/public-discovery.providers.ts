import type { Provider } from '@angular/core';
import {
  PUBLIC_DISCOVERY,
  PUBLIC_DISCOVERY_URL,
} from './application/public-discovery.port';
import { PublicDiscoveryApiService } from './infrastructure/public-discovery-api.service';

export function providePublicDiscovery(origin: string): Provider[] {
  if (origin) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid discovery API origin');
  }
  return [
    { provide: PUBLIC_DISCOVERY_URL, useValue: origin.replace(/\/$/, '') },
    { provide: PUBLIC_DISCOVERY, useClass: PublicDiscoveryApiService },
  ];
}
