import { ExploreUnavailableError, exploreId } from '@domains/feed';
import { reviewSummary } from '@sdk/features/review/core';
import type { ExploreReviewSummaries } from './explore-ratings';
import { reviewOwnerPath } from '../reviews/review-owner-path';

export class HttpExploreReviewSummaries implements ExploreReviewSummaries {
  constructor(
    private readonly origin: string | undefined,
    private readonly request: typeof fetch = fetch
  ) {}
  async read(applicationId: string) {
    if (!this.origin)
      throw new ExploreUnavailableError('Review service is unconfigured');
    const url = new URL(this.origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ExploreUnavailableError('Invalid review service origin');
    const response = await this.request(
      url.origin + reviewOwnerPath(exploreId(applicationId), '/summary'),
      {
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      }
    );
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('application/json')
    ) {
      await response.body?.cancel();
      throw new ExploreUnavailableError('Reviews unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ExploreUnavailableError('Missing review summary');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096)
          throw new ExploreUnavailableError('Review summary exceeds bounds');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const summary = reviewSummary(
      JSON.parse(Buffer.concat(chunks).toString('utf8'))
    );
    return { total: summary.total, rating: summary.average };
  }
}
