import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  PublicCommentContent,
  PublicDiscussionTopic,
  PublicApplicationDiscussionPage,
  PublicApplicationDiscussion,
  DiscussionVote,
} from '@domains/discussion';

export type ApplicationDiscussionCommand = { applicationId: string } & (
  | { type: 'create'; content: PublicDiscussionTopic }
  | { type: 'reply'; id: string; content: PublicCommentContent }
  | {
      type: 'edit';
      id: string;
      root: boolean;
      content: PublicCommentContent | PublicDiscussionTopic;
      expectedRevision: number;
    }
  | { type: 'remove'; id: string; expectedRevision: number }
  | { type: 'pin'; id: string; expectedRevision: number; pinned: boolean }
  | {
      type: 'vote';
      id: string;
      expectedRevision: number;
      value: DiscussionVote;
    }
);
export interface ApplicationDiscussionReceipt {
  id: string;
  discussionId: string;
  revision: number;
  projection: 'pending';
}
export interface ApplicationDiscussionAttempt {
  command: ApplicationDiscussionCommand;
  key: string;
}
export interface ApplicationDiscussionsPort {
  list(
    applicationId: string,
    cursor: string | null
  ): Observable<Result<PublicApplicationDiscussionPage, Error>>;
  read(
    applicationId: string,
    threadId: string
  ): Observable<Result<PublicApplicationDiscussion, Error>>;
  change(
    command: ApplicationDiscussionCommand,
    key: string
  ): Observable<Result<ApplicationDiscussionReceipt, Error>>;
}
export const APPLICATION_DISCUSSIONS =
  new InjectionToken<ApplicationDiscussionsPort>('APPLICATION_DISCUSSIONS');

export const APPLICATION_DISCUSSION_ORIGIN = new InjectionToken<string>(
  'APPLICATION_DISCUSSION_ORIGIN'
);
export class DiscussionRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain = false,
    readonly status = 0
  ) {
    super(message);
  }
}
