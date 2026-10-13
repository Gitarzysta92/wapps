import type { Provider } from '@angular/core';
import { ARTICLE_COMMENTS } from './application/article-comments.port';
import { ArticleCommentsService } from './application/article-comments.service';
import { ArticleCommentsApiService } from './infrastructure/article-comments-api.service';

/** The host supplies its session and provideMentionMembers for the account API. */
export function provideArticleComments(): Provider[] {
  return [
    ArticleCommentsService,
    { provide: ARTICLE_COMMENTS, useExisting: ArticleCommentsApiService },
  ];
}
