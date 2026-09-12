import { Injectable, InjectionToken } from '@angular/core';
import { of } from 'rxjs';
import { APPLICATIONS } from '@portals/shared/data';
import { IApplicationOverviewProvider } from '../application/overview-providers.port';

export const LOCAL_APPLICATION_DATA = new InjectionToken<boolean>('LOCAL_APPLICATION_DATA', { factory: () => false });

export class ApplicationNotFoundError extends Error {
  readonly status = 404;
  constructor() { super('Application not found'); }
}

@Injectable()
export class OverviewLocalService implements IApplicationOverviewProvider {
  getOverview(slug: string) {
    const app = APPLICATIONS.find(item => item.slug === slug);
    return of(app
      ? { ok: true as const, value: structuredClone(app) }
      : { ok: false as const, error: new ApplicationNotFoundError() });
  }
}
