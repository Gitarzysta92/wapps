import type { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  parseProfileActivityBatch,
  type ProfileActivityPosition,
  type ProfileActivitySharing,
} from '@domains/customer/profiles';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { PublicProfileActivitySource } from '@wapps/account';

export class RemoteProfileActivity implements PublicProfileActivitySource {
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
      throw new Error('Invalid profile activity service configuration');
    this.origin = url.origin;
  }
  async read(
    ownerIdentityId: string,
    after: ProfileActivityPosition | null,
    sharing: ProfileActivitySharing
  ) {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(
          `${this.origin}/api/internal/profile-activity`,
          { ownerIdentityId, after, sharing },
          {
            headers: {
              'x-profile-reader': this.credential,
              Accept: 'application/json',
            },
            timeout: 8000,
            maxRedirects: 0,
            maxContentLength: 128 * 1024,
            maxBodyLength: 4096,
          }
        )
      );
      return parseProfileActivityBatch(response.data);
    } catch {
      throw new CanonicalIdentityUnavailable(
        'Profile activity content unavailable'
      );
    }
  }
}
