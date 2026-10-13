import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { parseArticlePage } from '@domains/publication/article';
import { ExploreUnavailableError, type DigestArticles } from '@domains/feed';

@Injectable()
export class DigestArticlesClient implements DigestArticles {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}
  async read() {
    const origin = this.config.get<string>('EDITORIAL_URL');
    if (!origin)
      throw new ExploreUnavailableError('Article source is unavailable');
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ExploreUnavailableError('Invalid article source origin');
    const response = await firstValueFrom(
      this.http.get<unknown>(url.origin + '/api/catalog/articles', {
        params: { page: '1' },
        timeout: 15_000,
        maxRedirects: 0,
        maxContentLength: 512 * 1024,
        headers: { Accept: 'application/json' },
      })
    );
    const result = parseArticlePage(response.data);
    if (result.page !== 1)
      throw new ExploreUnavailableError('Unexpected article page');
    return result;
  }
}
