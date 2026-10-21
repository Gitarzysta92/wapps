import type { Provider } from '@angular/core';
import { DIGEST_PORT, DIGEST_URL } from './application/digest.port';
import { DigestApiService } from './infrastructure/digest-api.service';

/** The host also composes real preferences, favorites and authentication providers. */
export function provideDigest(origin: string): Provider[] {
  if (origin) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid Digest API origin');
  }
  return [
    { provide: DIGEST_URL, useValue: origin.replace(/\/$/, '') },
    { provide: DIGEST_PORT, useClass: DigestApiService },
  ];
}
