import type { Provider } from '@angular/core';
import { of } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import {
  MENTION_INBOX,
  MENTION_INBOX_URL,
  type MentionInboxPort,
} from './application/mention-inbox.port';
import { MentionInboxService } from './application/mention-inbox.service';
import { MentionInboxApiService } from './infrastructure/mention-inbox-api.service';

export function provideMentionInbox(
  mode: 'api' | 'demo',
  apiUrl: string
): Provider[] {
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid notification API origin');
  }
  const unavailable = () =>
    of(err(new Error('Mention notifications are not delivered in demo mode.')));
  const demo: MentionInboxPort = { list: unavailable, markRead: unavailable };
  return [
    MentionInboxService,
    { provide: MENTION_INBOX_URL, useValue: apiUrl.replace(/\/$/, '') },
    mode === 'api'
      ? { provide: MENTION_INBOX, useClass: MentionInboxApiService }
      : { provide: MENTION_INBOX, useValue: demo },
  ];
}
