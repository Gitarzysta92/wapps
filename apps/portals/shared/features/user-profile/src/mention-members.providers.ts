import type { Provider } from '@angular/core';
import { of } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import {
  MENTION_MEMBERS,
  MENTION_MEMBERS_URL,
  type MentionMembersPort,
} from './application/mention-members.port';
import { MentionMembersApiService } from './infrastructure/mention-members-api.service';

export function provideMentionMembers(
  mode: 'api' | 'demo',
  origin: string
): Provider[] {
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
      throw new Error('Invalid member directory origin');
  }
  const unavailable = () =>
    of(err(new Error('Member mentions are not delivered in demo mode.')));
  const demo: MentionMembersPort = {
    directory: unavailable,
    read: unavailable,
  };
  return [
    { provide: MENTION_MEMBERS_URL, useValue: origin.replace(/\/$/, '') },
    mode === 'api'
      ? { provide: MENTION_MEMBERS, useClass: MentionMembersApiService }
      : { provide: MENTION_MEMBERS, useValue: demo },
  ];
}
