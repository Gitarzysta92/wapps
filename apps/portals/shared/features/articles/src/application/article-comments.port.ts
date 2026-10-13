import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  PublicCommentContent,
  PublicCommentPage,
  PublicCommentThread,
} from '@domains/discussion';

export type ArticleCommentCommand = { articleId: string } & (
  | { type: 'create'; content: PublicCommentContent }
  | { type: 'reply'; id: string; content: PublicCommentContent }
  | {
      type: 'edit';
      id: string;
      content: PublicCommentContent;
      expectedRevision: number;
    }
  | { type: 'remove'; id: string; expectedRevision: number }
);
export interface ArticleCommentReceipt {
  id: string;
  discussionId: string;
  revision: number;
  projection: 'pending';
}
export interface ArticleCommentAttempt {
  command: ArticleCommentCommand;
  key: string;
}
export interface ArticleCommentsPort {
  list(
    articleId: string,
    cursor: string | null
  ): Observable<Result<PublicCommentPage, Error>>;
  read(
    articleId: string,
    threadId: string
  ): Observable<Result<PublicCommentThread, Error>>;
  change(
    command: ArticleCommentCommand,
    key: string
  ): Observable<Result<ArticleCommentReceipt, Error>>;
}
export const ARTICLE_COMMENTS = new InjectionToken<ArticleCommentsPort>(
  'ARTICLE_COMMENTS'
);
