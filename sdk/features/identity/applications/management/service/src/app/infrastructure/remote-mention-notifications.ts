import {
  commentObject,
  notificationRecipient,
  publicCommentId,
  mentionNotificationLease,
  mentionNotificationTarget,
  MENTION_NOTIFICATION_PAGE_SIZE,
} from '@sdk/features/discussion/core';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import type { MentionNotificationSource } from '@sdk/features/identity/libs/management';

export class RemoteMentionNotifications implements MentionNotificationSource {
  private readonly endpoint: string;
  constructor(
    origin: string,
    private readonly secret: string,
    private readonly enabled = true
  ) {
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(secret)
    )
      throw new Error('Invalid notification source configuration');
    this.endpoint = new URL('/api/internal/mention-notifications', url).href;
  }

  async claim() {
    return this.request({ operation: 'claim' }, (value) => {
      const row = commentObject(value, ['lease']);
      return row['lease'] === null
        ? null
        : mentionNotificationLease(row['lease']);
    });
  }

  async settle(id: string, token: string, failed: boolean): Promise<void> {
    await this.request(
      {
        operation: failed ? 'defer' : 'ack',
        id: publicCommentId(id),
        token: publicCommentId(token),
      },
      (value) => {
        const row = commentObject(value, ['status']);
        if (row['status'] !== 'settled' && row['status'] !== 'superseded')
          throw new Error('Invalid notification acknowledgement');
      }
    );
  }

  resolve(recipientId: string, ids: string[]) {
    if (!this.enabled)
      throw new CanonicalIdentityUnavailable('Mention delivery is not enabled');
    notificationRecipient(recipientId);
    if (
      ids.length > MENTION_NOTIFICATION_PAGE_SIZE ||
      new Set(ids).size !== ids.length
    )
      throw new Error('Invalid notification selection');
    ids.forEach(publicCommentId);
    if (!ids.length) return Promise.resolve([]);
    return this.request({ operation: 'resolve', recipientId, ids }, (value) => {
      const row = commentObject(value, ['items']);
      if (!Array.isArray(row['items']) || row['items'].length > ids.length)
        throw new Error('Invalid notification selection');
      const items = row['items'].map(mentionNotificationTarget);
      if (
        new Set(items.map((item) => item.id)).size !== items.length ||
        items.some((item) => !ids.includes(item.id))
      )
        throw new Error('Notification selection scope differs');
      return items;
    });
  }

  private async request<T>(
    body: unknown,
    parse: (value: unknown) => T
  ): Promise<T> {
    let response: Response | undefined;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: {
          'content-type': 'application/json',
          'x-notification-worker': this.secret,
        },
        body: JSON.stringify(body),
      });
      if (
        response.status !== 200 ||
        !response.headers.get('content-type')?.startsWith('application/json') ||
        !response.body
      )
        throw new Error('Invalid notification source response');
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 32_768)
            throw new Error('Notification response exceeds bounds');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      return parse(
        JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.concat(chunks)
          )
        )
      );
    } catch {
      await response?.body?.cancel().catch(() => undefined);
      throw new CanonicalIdentityUnavailable('Notification source unavailable');
    }
  }
}
