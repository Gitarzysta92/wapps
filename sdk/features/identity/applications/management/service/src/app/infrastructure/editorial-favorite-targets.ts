import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { parseCatalogSelection } from '@domains/catalog/record';
import { parsePublicSuiteSelection } from '@domains/publication/suite';
import { parseArticleSelection } from '@domains/publication/article';
import {
  parseFavoriteTarget,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import {
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import type { FavoriteTargetEligibility } from '@wapps/account';

/** Public target eligibility stays with Editorial; account authorization stays with the caller. */
export class EditorialFavoriteTargets implements FavoriteTargetEligibility {
  private readonly origin: string;

  constructor(private readonly http: HttpService, origin: string) {
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
    this.origin = url.origin;
  }

  async available(input: FavoriteTarget): Promise<boolean> {
    const target = parseFavoriteTarget(input);
    if (
      target.kind !== 'applications' &&
      target.kind !== 'suites' &&
      target.kind !== 'articles'
    )
      throw new CanonicalIdentityInputError(
        `Favorites for ${target.kind} are not yet available`
      );
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(
          `${this.origin}/api/catalog/${
            target.kind === 'articles'
              ? 'article-selection'
              : target.kind === 'suites'
              ? 'suite-selection'
              : 'app-selection'
          }`,
          {
            params: { ids: target.id },
            timeout: 5000,
            maxRedirects: 0,
            maxContentLength: 1024 * 1024,
            headers: { Accept: 'application/json' },
          }
        )
      );
      return (
        (target.kind === 'articles'
          ? parseArticleSelection(response.data, [target.id])
          : target.kind === 'suites'
          ? parsePublicSuiteSelection(response.data, [target.id])
          : parseCatalogSelection(response.data, [target.id])
        ).items.length === 1
      );
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Favorite target lookup unavailable'
      );
    }
  }
}
