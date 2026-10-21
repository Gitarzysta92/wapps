import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';

export interface MentionMember {
  id: string;
  name: string;
}
export interface MentionMembersPort {
  directory(
    after: string | null
  ): Observable<
    Result<{ items: MentionMember[]; after: string | null }, Error>
  >;
  read(id: string): Observable<Result<MentionMember | null, Error>>;
}
export const MENTION_MEMBERS = new InjectionToken<MentionMembersPort>(
  'MENTION_MEMBERS'
);
export const MENTION_MEMBERS_URL = new InjectionToken<string>(
  'MENTION_MEMBERS_URL'
);
