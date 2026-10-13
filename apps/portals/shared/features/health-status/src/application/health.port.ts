import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { ApplicationHealthReport } from '@domains/reliability';

export interface ApplicationHealthPort {
  read(slug: string): Observable<Result<ApplicationHealthReport, Error>>;
}
export const APPLICATION_HEALTH = new InjectionToken<ApplicationHealthPort>(
  'APPLICATION_HEALTH'
);
export const APPLICATION_HEALTH_URL = new InjectionToken<string>(
  'APPLICATION_HEALTH_URL'
);
