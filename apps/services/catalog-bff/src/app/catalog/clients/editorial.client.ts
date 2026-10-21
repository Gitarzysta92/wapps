import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import {
  CatalogReadPort,
  CatalogReadQuery,
  CatalogUnavailableError,
  catalogAppIds,
  catalogQueryParameters,
  catalogSlug,
  parseCatalogApp,
  parseCatalogFacets,
  parseCatalogPage,
  parseCatalogSelection,
} from '@domains/catalog/record';

@Injectable()
export class EditorialClient implements CatalogReadPort {
  private readonly baseUrl: string;

  constructor(private readonly http: HttpService, config: ConfigService) {
    const origin = config.get<string>('EDITORIAL_URL');
    if (!origin) throw new Error('EDITORIAL_URL is required');
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('EDITORIAL_URL must be an HTTP service origin');
    this.baseUrl = url.origin;
  }

  async browse(query: CatalogReadQuery) {
    try {
      const page = parseCatalogPage(
        await this.get('/api/catalog/apps', catalogQueryParameters(query))
      );
      if (
        page.pageSize !== query.pageSize ||
        page.page !== Math.min(query.page, page.totalPages)
      )
        throw new CatalogUnavailableError('Unexpected catalog pagination');
      return page;
    } catch {
      throw new CatalogUnavailableError('Catalog is temporarily unavailable');
    }
  }

  async find(input: string) {
    const slug = catalogSlug(input);
    try {
      const app = parseCatalogApp(
        await this.get(`/api/catalog/apps/${encodeURIComponent(slug)}`)
      );
      if (app.slug !== slug)
        throw new CatalogUnavailableError('Unexpected catalog application');
      return app;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw new CatalogUnavailableError('Catalog is temporarily unavailable');
    }
  }

  async facets() {
    try {
      return parseCatalogFacets(await this.get('/api/catalog/facets'));
    } catch {
      throw new CatalogUnavailableError(
        'Catalog taxonomy is temporarily unavailable'
      );
    }
  }

  async select(input: string[]) {
    const ids = catalogAppIds(input);
    try {
      return parseCatalogSelection(
        await this.get('/api/catalog/app-selection', { ids: ids.join(',') }),
        ids
      );
    } catch {
      // Absence is a successful empty selection. Transport/projection errors stay retryable.
      throw new CatalogUnavailableError('Catalog is temporarily unavailable');
    }
  }

  private async get(
    path: string,
    params?: Record<string, string>
  ): Promise<unknown> {
    const response = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}${path}`, {
        params,
        timeout: 15_000,
        maxRedirects: 0,
        maxContentLength: 16 * 1024 * 1024,
        headers: { Accept: 'application/json' },
      })
    );
    return response.data;
  }
}
