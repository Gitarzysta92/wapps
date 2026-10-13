import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { MentionInboxPage } from '@domains/discussion';

export interface MentionInboxPort {
  list(cursor: string | null): Observable<Result<MentionInboxPage, Error>>;
  markRead(
    id: string
  ): Observable<Result<{ id: string; readAt: number }, Error>>;
}
export const MENTION_INBOX = new InjectionToken<MentionInboxPort>(
  'MENTION_INBOX'
);
export const MENTION_INBOX_URL = new InjectionToken<string>(
  'MENTION_INBOX_URL'
);
