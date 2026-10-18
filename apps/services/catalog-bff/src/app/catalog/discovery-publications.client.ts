import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  parseArticlePage,
  type ArticleBrowseQuery,
} from '@domains/publication/article';
import {
  parsePublicSuitePage,
  parsePublicSuiteSelection,
  type PublicSuiteQuery,
} from '@domains/publication/suite';
import { DiscoveryUnavailableError } from '@domains/discovery';
import type { DiscoveryPublications } from './discovery.service';

@Injectable()
export class DiscoveryPublicationsClient implements DiscoveryPublications {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}
  async articles(query: ArticleBrowseQuery) {
    return parseArticlePage(await this.get('articles', query));
  }
  async suites(query: PublicSuiteQuery) {
    return parsePublicSuitePage(await this.get('suites', query));
  }
  async suiteSelection(ids: string[]) {
    return parsePublicSuiteSelection(await this.get('suite-selection', { ids: ids.join(',') }), ids);
  }
  private async get(
    kind: string,
    params: ArticleBrowseQuery | PublicSuiteQuery | { ids: string }
  ) {
    const origin = this.config.get<string>('EDITORIAL_URL');
    if (!origin)
      throw new DiscoveryUnavailableError('Discovery source is unavailable');
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new DiscoveryUnavailableError('Invalid discovery source origin');
    const response = await firstValueFrom(
      this.http.get<unknown>(`${url.origin}/api/catalog/${kind}`, {
        params,
        timeout: 15_000,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        headers: { Accept: 'application/json' },
      })
    );
    return response.data;
  }
}
