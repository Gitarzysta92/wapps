import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { catalogSlug } from '@domains/catalog/record';
import {
  HealthNotFoundError,
  HealthUnavailableError,
  healthObject,
  parseApplicationHealthReport,
} from '@domains/reliability';

@Injectable()
export class ApplicationHealthClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}
  async read(inputSlug: unknown, query: unknown) {
    const slug = catalogSlug(inputSlug);
    healthObject(query, []);
    try {
      const origin = this.config.get<string>('EDITORIAL_URL');
      if (!origin) throw new Error('Unconfigured health source');
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid health source');
      const response = await firstValueFrom(
        this.http.get<unknown>(
          url.origin +
            '/api/catalog/application-health/' +
            encodeURIComponent(slug),
          {
            timeout: 15_000,
            maxRedirects: 0,
            maxContentLength: 256 * 1024,
            headers: { Accept: 'application/json' },
          }
        )
      );
      const report = parseApplicationHealthReport(response.data);
      if (report.application.slug !== slug)
        throw new Error('Unexpected application');
      return report;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404)
        throw new HealthNotFoundError('Application not found');
      throw new HealthUnavailableError(
        'Application observations are temporarily unavailable'
      );
    }
  }
}
