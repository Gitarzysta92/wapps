import { parseCatalogSelection } from '@domains/catalog/record';
import { parseArticleSelection } from '@domains/publication/article';
import { classificationFields } from '@domains/publication/classification';
import type { DiscussionTarget } from '@sdk/features/discussion/core';
import type { ProfileDiscussionParents } from '../application/profile-discussions';

export class EditorialProfileDiscussionParents
  implements ProfileDiscussionParents
{
  private readonly origin: string;
  constructor(origin: string, private readonly request: typeof fetch = fetch) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid Editorial profile origin');
    this.origin = url.origin;
  }
  async select(targets: DiscussionTarget[]) {
    if (targets.length > 10)
      throw new Error('Profile parent selection exceeds bounds');
    const selected: Awaited<ReturnType<ProfileDiscussionParents['select']>> =
      [];
    for (const kind of ['application', 'article'] as const) {
      const ids = [
        ...new Set(
          targets
            .filter((target) => target.kind === kind)
            .map((target) => target.id)
        ),
      ];
      if (!ids.length) continue;
      const response = await this.request(
        `${this.origin}/api/catalog/${
          kind === 'application' ? 'app' : 'article'
        }-selection?ids=${ids.join(',')}`,
        {
          redirect: 'error',
          signal: AbortSignal.timeout(3000),
          headers: { Accept: 'application/json' },
        }
      );
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/json')
      ) {
        await response.body?.cancel();
        throw new Error('Profile parent metadata unavailable');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Profile parent metadata missing');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1024 * 1024)
            throw new Error('Profile parent metadata exceeds bounds');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (kind === 'application') {
        for (const item of parseCatalogSelection(body, ids).items)
          selected.push({
            target: { kind, id: item.id },
            title: item.name,
            slug: item.slug,
            ...classificationFields(item.classification),
            categories: [
              ...new Set(item.categories.flatMap((c) => [c.id, c.slug])),
            ],
            tags: [...new Set(item.tags.flatMap((t) => [t.id, t.slug]))],
          });
      } else {
        for (const item of parseArticleSelection(body, ids).items)
          selected.push({
            target: { kind, id: item.id },
            title: item.title,
            slug: item.slug,
            ...classificationFields(item.classification),
          });
      }
    }
    return selected;
  }
}
