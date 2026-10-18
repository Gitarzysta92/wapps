import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  parseFavoriteTarget,
  parseFavoriteUpdateState,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { FavoriteUpdateSource } from '@wapps/account';

export class RemoteFavoriteUpdates implements FavoriteUpdateSource {
  private readonly editorial: string;
  private readonly discussion: string;
  constructor(
    private readonly http: HttpService,
    editorial: string,
    discussion: string,
    private readonly secret: string
  ) {
    const endpoint = (origin: string) => {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid update service origin');
      return new URL('/api/internal/favorite-updates', url).href;
    };
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(secret))
      throw new Error('Invalid update credential');
    this.editorial = endpoint(editorial);
    this.discussion = endpoint(discussion);
  }
  async read(input: FavoriteTarget) {
    const target = parseFavoriteTarget(input);
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(
          target.kind === 'discussions' ? this.discussion : this.editorial,
          target,
          {
            timeout: 5000,
            maxRedirects: 0,
            maxContentLength: 32_768,
            headers: {
              'x-notification-worker': this.secret,
              Accept: 'application/json',
            },
          }
        )
      );
      if (response.status !== 200) throw new Error('Invalid update response');
      const state = parseFavoriteUpdateState(response.data);
      if (state.target.kind !== target.kind || state.target.id !== target.id)
        throw new Error('Update scope differs');
      return state;
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Favorite update source unavailable'
      );
    }
  }
}
