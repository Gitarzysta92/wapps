import { discussionTarget, type DiscussionTarget } from '@domains/community';
import type { DiscussionTargets } from '../application/discussion-targets.port';

export class EditorialDiscussionTargets implements DiscussionTargets {
  constructor(
    private readonly origin: string | undefined,
    private readonly publicTenant: string,
    private readonly request: typeof fetch = fetch
  ) {}

  async visible(input: DiscussionTarget, tenantId: string): Promise<boolean> {
    const target = discussionTarget(input);
    if (tenantId !== this.publicTenant) return false;
    if (!this.origin)
      throw new Error('Editorial target authority is not configured');
    const origin = new URL(this.origin);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    )
      throw new Error('Editorial target authority must be an HTTP origin');
    const response = await this.request(
      new URL(`/api/catalog/${target.kind}-visibility/${target.id}`, origin),
      {
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
        headers: { accept: 'application/json' },
      }
    );
    if (response.status === 404) {
      await response.body?.cancel();
      return false;
    }
    if (
      response.status !== 200 ||
      !response.headers.get('content-type')?.includes('application/json')
    ) {
      await response.body?.cancel();
      throw new Error('Editorial target authority is unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Editorial target authority returned no body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096)
          throw new Error('Editorial target response exceeds limit');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'id,revision,tenantId' ||
      !('id' in body) ||
      body.id !== target.id ||
      !('tenantId' in body) ||
      body.tenantId !== tenantId ||
      !('revision' in body) ||
      !Number.isSafeInteger(body.revision) ||
      Number(body.revision) < 1
    )
      throw new Error('Invalid Editorial target authority response');
    return true;
  }
}
