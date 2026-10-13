import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { ReplyInboxPage } from '@domains/discussion';

export interface ReplyInboxPort {
  list(cursor: string | null): Observable<Result<ReplyInboxPage, Error>>;
  markRead(
    id: string
  ): Observable<Result<{ id: string; readAt: number }, Error>>;
}
export const REPLY_INBOX = new InjectionToken<ReplyInboxPort>('REPLY_INBOX');
export const REPLY_INBOX_URL = new InjectionToken<string>('REPLY_INBOX_URL');
