import {
  ExploreUnavailableError,
  parseExploreBatch,
  type ExplorePosition,
  type ExploreSource,
  type ExploreKind,
  isApplicationActivity,
} from '@domains/feed';

export class HttpExploreSource implements ExploreSource {
  constructor(
    private readonly origin: string | undefined,
    private readonly secret: string | undefined,
    private readonly kinds: readonly string[],
    private readonly request: typeof fetch = fetch
  ) {}
  async read(
    after: ExplorePosition | null,
    selectedKind?: ExploreKind,
    applicationId?: string
  ) {
    if (
      !this.origin ||
      !this.secret ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(this.secret)
    )
      throw new ExploreUnavailableError(
        'Explore source configuration is unavailable'
      );
    if (selectedKind && !this.kinds.includes(selectedKind))
      throw new ExploreUnavailableError('Unexpected Explore selection kind');
    const url = new URL(this.origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ExploreUnavailableError('Invalid Explore source origin');
    const response = await this.request(`${url.origin}/api/internal/explore`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-explore-reader': this.secret,
      },
      body: JSON.stringify({
        after,
        ...(selectedKind ? { kind: selectedKind } : {}),
        ...(applicationId ? { applicationId } : {}),
      }),
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('application/json')
    ) {
      await response.body?.cancel();
      throw new ExploreUnavailableError('Explore source unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader)
      throw new ExploreUnavailableError('Explore source returned no data');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512 * 1024)
          throw new ExploreUnavailableError('Explore source exceeds bounds');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const batch = parseExploreBatch(
      JSON.parse(Buffer.concat(chunks).toString('utf8'))
    );
    if (
      batch.items.some(
        (item) =>
          !this.kinds.includes(item.kind) ||
          (applicationId && !isApplicationActivity(item, applicationId)) ||
          (selectedKind && item.kind !== selectedKind)
      ) ||
      (batch.through &&
        (!this.kinds.includes(batch.through.key.split(':')[0]) ||
          (selectedKind && batch.through.key.split(':')[0] !== selectedKind)))
    )
      throw new ExploreUnavailableError('Unexpected Explore source kind');
    return batch;
  }
}
