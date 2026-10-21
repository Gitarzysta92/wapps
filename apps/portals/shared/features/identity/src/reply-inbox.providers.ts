import type { Provider } from '@angular/core';
import { of } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import {
  REPLY_INBOX,
  REPLY_INBOX_URL,
  type ReplyInboxPort,
} from './application/reply-inbox.port';
import { ReplyInboxService } from './application/reply-inbox.service';
import { ReplyInboxApiService } from './infrastructure/reply-inbox-api.service';

export function provideReplyInbox(
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
    of(err(new Error('Reply notifications are not delivered in demo mode.')));
  const demo: ReplyInboxPort = { list: unavailable, markRead: unavailable };
  return [
    ReplyInboxService,
    { provide: REPLY_INBOX_URL, useValue: apiUrl.replace(/\/$/, '') },
    mode === 'api'
      ? { provide: REPLY_INBOX, useClass: ReplyInboxApiService }
      : { provide: REPLY_INBOX, useValue: demo },
  ];
}
