import {
  commentObject,
  discussionMentionResolution,
  discussionMentionRecipients,
} from '@domains/community';
import type { DiscussionMentionDirectory } from '../application/discussion-mentions.port';

export class AccountDiscussionMentions implements DiscussionMentionDirectory {
  constructor(
    private readonly origin: string | undefined,
    private readonly secret: string | undefined,
    private readonly request: typeof fetch = fetch
  ) {}

  async resolve(authorId: string, profileIds: string[]) {
    const input = discussionMentionResolution({ authorId, profileIds });
    if (!input.profileIds.length) return [];
    if (
      !this.origin ||
      !this.secret ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(this.secret)
    )
      throw new Error('Mention recipient authority is not configured');
    const url = new URL(this.origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Mention recipient authority must be an HTTP origin');
    let response: Response | undefined;
    try {
      response = await this.request(
        new URL('/api/internal/mention-recipients', url),
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
          headers: {
            'content-type': 'application/json',
            'x-notification-worker': this.secret,
          },
          body: JSON.stringify(input),
        }
      );
      if (
        response.status !== 200 ||
        !response.headers.get('content-type')?.startsWith('application/json') ||
        !response.body
      )
        throw new Error('Invalid mention authority response');
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 8192)
            throw new Error('Mention authority response exceeds bounds');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const body = commentObject(
        JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.concat(chunks)
          )
        ),
        ['recipients']
      );
      return discussionMentionRecipients(body['recipients'], input.profileIds);
    } catch {
      await response?.body?.cancel().catch(() => undefined);
      throw new Error('Mention recipient authority unavailable');
    }
  }
}
