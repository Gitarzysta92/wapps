import type { Provider } from '@angular/core';
import {
  APPLICATION_HEALTH,
  APPLICATION_HEALTH_URL,
} from './application/health.port';
import { ApplicationHealthApiService } from './infrastructure/application-health-api.service';

export function provideApplicationHealth(origin: string): Provider[] {
  if (origin) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid health API origin');
  }
  return [
    { provide: APPLICATION_HEALTH_URL, useValue: origin.replace(/\/$/, '') },
    { provide: APPLICATION_HEALTH, useClass: ApplicationHealthApiService },
  ];
}
