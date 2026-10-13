import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { parseProfileArticlesPage } from '@domains/publication/article';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { PublicProfileArticlesPort } from '@sdk/features/identity/libs/management';

export class EditorialProfileArticles implements PublicProfileArticlesPort {
  private readonly origin: string;
  constructor(
    private readonly http: HttpService,
    origin: string,
    private readonly credential: string
  ) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !credential ||
      credential.length > 1024
    )
      throw new Error('Invalid profile article service configuration');
    this.origin = url.origin;
  }
  async read(ownerIdentityId: string, after: string | null) {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(
          `${this.origin}/api/internal/profile-articles`,
          { ownerIdentityId, after },
          {
            headers: {
              'x-profile-reader': this.credential,
              Accept: 'application/json',
            },
            timeout: 5000,
            maxRedirects: 0,
            maxContentLength: 128 * 1024,
            maxBodyLength: 2048,
          }
        )
      );
      const page = parseProfileArticlesPage(response.data);
      if (
        page.sharing !== 'visible' ||
        page.items.some((item) => after !== null && item.id <= after)
      )
        throw new Error('Invalid article continuation');
      return page;
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Shared article content unavailable'
      );
    }
  }
}
