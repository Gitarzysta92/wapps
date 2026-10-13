import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  ArticleBrowseQuery,
  ArticleDraft,
  ArticleFields,
  ArticlePage,
  ArticlePublicationAction,
  ArticlePublicationInput,
  ArticlePublicationReceipt,
  ArticlePublicationStatus,
  ArticleReceipt,
  ArticleReviewPage,
  PublishedArticle,
} from '@domains/publication/article';

export type ArticleChange =
  | { kind: 'draft'; type: 'create'; input: ArticleFields }
  | {
      kind: 'draft';
      type: 'update';
      id: string;
      input: ArticleFields & { expectedRevision: number };
    }
  | {
      kind: 'draft';
      type: 'delete';
      id: string;
      input: { expectedRevision: number };
    }
  | {
      kind: 'publication';
      id: string;
      action: ArticlePublicationAction;
      input: ArticlePublicationInput;
    };
export type ArticleChangeReceipt = ArticleReceipt | ArticlePublicationReceipt;
export interface ArticleWorkspacePort {
  list(): Observable<Result<ArticleDraft[], Error>>;
  read(id: string): Observable<Result<ArticleDraft, Error>>;
  status(
    id: string,
    review: boolean
  ): Observable<Result<ArticlePublicationStatus, Error>>;
  reviews(page: number): Observable<Result<ArticleReviewPage, Error>>;
  change(
    command: ArticleChange,
    key: string
  ): Observable<Result<ArticleChangeReceipt, Error>>;
}
export interface ArticleCatalogPort {
  browse(query: ArticleBrowseQuery): Observable<Result<ArticlePage, Error>>;
  find(slug: string): Observable<Result<PublishedArticle, Error>>;
}
export interface ArticleSession {
  key$: Observable<string | null>;
  currentKey(): string | null;
}
export class ArticleRequestError extends Error {
  constructor(
    message: string,
    readonly uncertain = false,
    readonly status = 0
  ) {
    super(message);
  }
}
export const ARTICLE_WORKSPACE = new InjectionToken<ArticleWorkspacePort>(
  'ARTICLE_WORKSPACE'
);
export const ARTICLE_CATALOG = new InjectionToken<ArticleCatalogPort>(
  'ARTICLE_CATALOG'
);
export const ARTICLE_SESSION = new InjectionToken<ArticleSession>(
  'ARTICLE_SESSION'
);
export const ARTICLE_ORIGIN = new InjectionToken<string>('ARTICLE_ORIGIN');
