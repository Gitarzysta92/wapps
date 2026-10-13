import { catalogSlug, type CatalogReadPort } from '@domains/catalog/record';
import {
  HealthNotFoundError,
  HealthUnavailableError,
  healthObject,
  parseApplicationHealthReport,
} from '@domains/reliability';
import type { ApplicationHealth } from './application-health';

export class PublicApplicationHealth {
  constructor(
    private readonly applications: Pick<CatalogReadPort, 'find'>,
    private readonly health: Pick<ApplicationHealth, 'read'>
  ) {}
  async read(inputSlug: unknown, inputQuery: unknown) {
    const slug = catalogSlug(inputSlug);
    healthObject(inputQuery, []);
    try {
      const app = await this.applications.find(slug);
      if (!app) throw new HealthNotFoundError('Application not found');
      const report = await this.health.read(app.id);
      const current = await this.applications.find(slug);
      if (!current) throw new HealthNotFoundError('Application not found');
      if (JSON.stringify(current) !== JSON.stringify(app))
        throw new HealthUnavailableError(
          'Application changed while reading observations'
        );
      return parseApplicationHealthReport({
        ...report,
        application: { id: app.id, name: app.name, slug: app.slug },
      });
    } catch (error) {
      if (error instanceof HealthNotFoundError) throw error;
      throw new HealthUnavailableError(
        'Application observations are temporarily unavailable'
      );
    }
  }
}
