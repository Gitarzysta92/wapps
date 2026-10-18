import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  parseProfileContentTotals,
  type ProfileContentCategory,
} from '@domains/customer/profiles';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { ProfileTotalsSource } from '@wapps/account';

export class RemoteProfileTotals implements ProfileTotalsSource {
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
      throw new Error('Invalid profile totals service configuration');
    this.origin = url.origin;
  }
  async read(
    ownerIdentityId: string,
    categories: readonly ProfileContentCategory[]
  ) {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(
          `${this.origin}/api/internal/profile-totals`,
          { ownerIdentityId, categories },
          {
            headers: {
              'x-profile-reader': this.credential,
              Accept: 'application/json',
            },
            timeout: 30000,
            maxRedirects: 0,
            maxContentLength: 128 * 1024,
            maxBodyLength: 4096,
          }
        )
      );
      return parseProfileContentTotals(response.data, categories);
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Profile totals content unavailable'
      );
    }
  }
}
