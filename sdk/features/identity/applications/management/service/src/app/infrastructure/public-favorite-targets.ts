import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  parseFavoriteTarget,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import { commentObject, publicCommentId } from '@domains/community';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { FavoriteTargetEligibility } from '@wapps/account';
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
          `${this.discussionOrigin}/api/discussions/selection`,
          {
            params: { ids: target.id, bindingPrefix: 'application:' },
            timeout: 5000,
            maxRedirects: 0,
            maxContentLength: 1024 * 1024,
            headers: { Accept: 'application/json' },
          }
        )
      );
      const page = commentObject(response.data, ['items']);
      if (!Array.isArray(page.items) || page.items.length > 1)
        throw new Error('Invalid discussion eligibility');
      if (!page.items.length) return false;
      const row = commentObject(page.items[0], [
        'id',
        'bindingKey',
        'revision',
        'replyCount',
        'comments',
        'pinned',
        'canPin',
      ]);
      if (
        row.id !== target.id ||
        typeof row.bindingKey !== 'string' ||
        !row.bindingKey.startsWith('application:') ||
        row.bindingKey !==
          `application:${publicCommentId(
            row.bindingKey.slice('application:'.length)
          )}` ||
        !Number.isSafeInteger(row.revision) ||
        Number(row.revision) < 1
      )
        throw new Error('Invalid discussion eligibility');
      return true;
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Favorite target lookup unavailable'
      );
    }
  }
}
