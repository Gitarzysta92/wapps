import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { MyDiscussion } from '@domains/community';

export interface MyDiscussionView extends MyDiscussion {
  applicationName: string;
  applicationSlug: string;
}
export interface MyDiscussionsPort {
  list(
    cursor: string | null
  ): Observable<
    Result<{ items: MyDiscussionView[]; next: string | null }, Error>
  >;
}
export const MY_DISCUSSIONS = new InjectionToken<MyDiscussionsPort>(
  'MY_DISCUSSIONS'
);
export const MY_DISCUSSIONS_ORIGIN = new InjectionToken<string>(
  'MY_DISCUSSIONS_ORIGIN'
);
