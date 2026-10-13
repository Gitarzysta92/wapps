import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  ARTICLE_LIMITS,
  articleId,
  articleSlug,
  parseArticleDraft,
  parseArticlePage,
  parseArticlePublicationReceipt,
  parseArticlePublicationStatus,
  parseArticleReceipt,
  parseArticleReviewPage,
  parsePublishedArticle,
  type ArticleBrowseQuery,
} from '@domains/publication/article';
import {
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
  ArticleRequestError,
  type ArticleCatalogPort,
  type ArticleChange,
  type ArticleWorkspacePort,
} from '../application/article-workspace.port';

@Injectable({ providedIn: 'root' })
export class ArticleApiService
  implements ArticleWorkspacePort, ArticleCatalogPort
{
  private readonly http = inject(HttpClient);
  private readonly origin = inject(ARTICLE_ORIGIN);
  private readonly session = inject(ARTICLE_SESSION);
  private readonly workspace = `${this.origin}/api/me/articles`;
  private readonly review = `${this.origin}/api/editorial/article-reviews`;
  list() {
    return this.result(
      this.http.get<unknown>(this.workspace).pipe(
        map((value) => {
          if (!Array.isArray(value) || value.length > ARTICLE_LIMITS.drafts)
            throw new Error('Invalid article workspace');
          const items = value.map(parseArticleDraft);
          if (new Set(items.map((item) => item.id)).size !== items.length)
            throw new Error('Duplicate article drafts');
          return items;
        })
      )
    );
  }
  read(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.workspace}/${articleId(id)}`)
      ).pipe(
        map((value) => {
          const item = parseArticleDraft(value);
          if (item.id !== id) throw new Error('Unexpected article draft');
          return item;
        })
      )
    );
  }
  status(id: string, review: boolean) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          review
            ? `${this.review}/${articleId(id)}`
            : `${this.workspace}/${articleId(id)}/publication`
        )
      ).pipe(
        map((value) => {
          const item = parseArticlePublicationStatus(value);
          if (item.id !== id) throw new Error('Unexpected article status');
          return item;
        })
      )
    );
  }
  reviews(page: number) {
    return this.result(
      this.http
        .get<unknown>(this.review, { params: { page: String(page) } })
        .pipe(
          map((value) => {
            const result = parseArticleReviewPage(value);
            if (result.page !== page)
              throw new Error('Unexpected article review page');
            return result;
          })
        )
    );
  }
  change(command: ArticleChange, key: string) {
    const session = this.session.currentKey();
    return this.result(
      defer(() => {
        if (!session || session !== this.session.currentKey())
          throw new ArticleRequestError(
            'The account session changed. Reload before continuing.',
            false,
            401
          );
        let method = 'POST',
          url: string,
          body: unknown;
        if (command.kind === 'publication') {
          const review =
            command.action === 'approve' || command.action === 'reject';
          url = review
            ? `${this.review}/${articleId(command.id)}/decision`
            : `${this.workspace}/${articleId(command.id)}/${command.action}`;
          body = review
            ? { decision: command.action, ...command.input }
            : {
                expectedRevision: command.input.expectedRevision,
                expectedPublicationRevision:
                  command.input.expectedPublicationRevision,
              };
        } else {
          method =
            command.type === 'delete'
              ? 'DELETE'
              : command.type === 'update'
              ? 'PUT'
              : 'POST';
          url =
            command.type === 'create'
              ? this.workspace
              : `${this.workspace}/${articleId(command.id)}`;
          body = command.input;
        }
        return this.http.request<unknown>(method, url, {
          body,
          headers: { 'Idempotency-Key': key },
        });
      }).pipe(
        map((value) => {
          const receipt =
            command.kind === 'publication'
              ? parseArticlePublicationReceipt(value)
              : parseArticleReceipt(value);
          const expectedRevision =
            'expectedRevision' in command.input
              ? command.input.expectedRevision
              : 0;
          if (
            receipt.revision !== expectedRevision + 1 ||
            ('id' in command && receipt.id !== command.id)
          )
            throw new Error('Unexpected article receipt');
          if (
            command.kind === 'publication' &&
            (!('action' in receipt) ||
              receipt.action !== command.action ||
              ((command.action === 'approve' || command.action === 'reject') &&
                receipt.submittedRevision !== command.input.submittedRevision))
          )
            throw new Error('Unexpected publication receipt');
          if (
            command.kind === 'draft' &&
            (!('deleted' in receipt) ||
              receipt.deleted !== (command.type === 'delete'))
          )
            throw new Error('Unexpected draft receipt');
          return receipt;
        })
      ),
      true
    );
  }
  browse(query: ArticleBrowseQuery) {
    return this.result(
      this.http
        .get<unknown>(`${this.origin}/api/catalog/articles`, {
          params: { ...query, page: String(query.page) },
        })
        .pipe(
          map((value) => {
            const page = parseArticlePage(value);
            if (
              page.page !== query.page ||
              page.items.some(
                (item) =>
                  (query.category && item.category !== query.category) ||
                  (query.tag && !item.tags.includes(query.tag))
              )
            )
              throw new Error('Unexpected article page');
            return page;
          })
        )
    );
  }
  find(slug: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.origin}/api/catalog/articles/${articleSlug(slug)}`
        )
      ).pipe(
        map((value) => {
          const item = parsePublishedArticle(value);
          if (item.slug !== slug) throw new Error('Unexpected article');
          return item;
        })
      )
    );
  }
  private result<T>(
    source: Observable<T>,
    mutation = false
  ): Observable<Result<T, Error>> {
    return source.pipe(
      map(ok),
      catchError((failure: unknown) => {
        if (failure instanceof ArticleRequestError) return of(err(failure));
        const status =
          failure instanceof HttpErrorResponse ? failure.status : 0;
        const uncertain =
          mutation && ![400, 401, 403, 404, 409].includes(status);
        const message =
          status === 409
            ? 'The article changed, its URL is reserved, or the requested action is no longer available. Reload and compare before continuing.'
            : status === 404
            ? 'Article not found or no longer available.'
            : status === 403
            ? 'Your account cannot perform this action. Staff cannot review their own articles.'
            : status === 401
            ? 'Sign in again to continue.'
            : status === 400
            ? 'Check the article fields and review reason.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Articles are unavailable or updating. Try again shortly.';
        return of(err(new ArticleRequestError(message, uncertain, status)));
      })
    );
  }
}
