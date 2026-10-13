import {
  accountErasureReceipt,
  accountErasureRequest,
  CanonicalIdentityUnavailable,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import type { AccountErasureParticipant } from '@sdk/features/identity/libs/management';

export class RemoteAccountErasureParticipant
  implements AccountErasureParticipant
{
  private readonly endpoint: string;
  constructor(
    readonly name: 'editorial' | 'discussion',
    origin: string,
    private readonly secret: string
  ) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(secret)
    )
      throw new Error('Invalid account erasure participant configuration');
    this.endpoint = new URL('/api/internal/account-erasure', url).href;
  }
  async request(input: AccountErasureRequest) {
    const request = accountErasureRequest(input);
    let response: Response | undefined;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: {
          'content-type': 'application/json',
          'x-account-erasure-writer': this.secret,
        },
        body: JSON.stringify(request),
      });
      if (
        ![200, 202].includes(response.status) ||
        !response.headers.get('content-type')?.startsWith('application/json') ||
        !response.body
      )
        throw new Error('Invalid erasure response');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 4096)
            throw new Error('Account erasure receipt exceeds limit');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const receipt = accountErasureReceipt(
        JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.concat(chunks)
          )
        )
      );
      if (
        receipt.identityId !== request.identityId ||
        receipt.revision !== request.revision ||
        receipt.participant !== this.name ||
        response.status !== (receipt.state === 'pending' ? 202 : 200)
      )
        throw new Error('Account erasure receipt differs from request');
      return receipt;
    } catch {
      await response?.body?.cancel().catch(() => undefined);
      throw new CanonicalIdentityUnavailable(
        'Account erasure participant unavailable'
      );
    }
  }
}
