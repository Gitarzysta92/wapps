import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  parseFavoriteTarget,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import { parseDiscussionSelection } from '@domains/discussion/contracts';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { FavoriteTargetEligibility } from '@sdk/features/identity/libs/management';
import { EditorialFavoriteTargets } from './editorial-favorite-targets';

export class PublicFavoriteTargets implements FavoriteTargetEligibility {
  private readonly editorial: EditorialFavoriteTargets;
  private readonly discussionOrigin: string;

  constructor(
    private readonly http: HttpService,
    editorialOrigin: string,
    discussionOrigin: string
  ) {
    this.editorial = new EditorialFavoriteTargets(http, editorialOrigin);
    const url = new URL(discussionOrigin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('DISCUSSION_URL must be an HTTP service origin');
    this.discussionOrigin = url.origin;
  }

  async available(input: FavoriteTarget): Promise<boolean> {
    const target = parseFavoriteTarget(input);
    if (target.kind !== 'discussions') return this.editorial.available(target);
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(
          `${this.discussionOrigin}/api/discussion-selection`,
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
        parseDiscussionSelection(response.data, [target.id]).items.length === 1
      );
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Favorite target lookup unavailable'
      );
    }
  }
}
