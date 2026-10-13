import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  ARTICLE_COVER_RETAINED_LIMIT,
  ARTICLE_COVER_SOURCE_LIMIT,
  ARTICLE_COVER_OUTPUT_LIMIT,
  articleCoverId,
  articleCoverInteger,
  parseArticleCoverSource,
  parseArticleCoverUpload,
  parseArticleCoverUploadReceipt,
  type ArticleCoverUploadInput,
} from '@domains/catalog/media';
import {
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
  ArticleRequestError,
} from '../application/article-workspace.port';
import type {
  ArticleCoverPort,
  ArticleCoverPreview,
} from '../application/article-cover.port';

@Injectable({ providedIn: 'root' })
export class ArticleCoverApiService implements ArticleCoverPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(ARTICLE_ORIGIN);
  private readonly session = inject(ARTICLE_SESSION);
  private readonly images = this.origin + '/api/me/article-covers';
  private readonly drafts = this.origin + '/api/me/articles';
  inspect(file: File) {
    return defer(async () => {
      if (
        !file.size ||
        file.size > ARTICLE_COVER_SOURCE_LIMIT ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      )
        throw new Error('Choose a PNG, JPEG or WebP image of at most 8 MiB.');
      const hash = await crypto.subtle.digest(
        'SHA-256',
        await file.arrayBuffer()
      );
      return parseArticleCoverSource({
        contentType: file.type,
        bytes: file.size,
        sha256: Array.from(new Uint8Array(hash), (value) =>
          value.toString(16).padStart(2, '0')
        ).join(''),
      });
    }).pipe(
      map(ok),
      catchError((error: unknown) =>
        of(
          err(
            error instanceof Error
              ? error
              : new Error('The image could not be read. Select the file again.')
          )
        )
      )
    );
  }
  list(articleId: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(this.images, {
          params: { articleId: articleCoverId(articleId) },
        })
      ).pipe(
        map((value) => {
          if (
            !Array.isArray(value) ||
            value.length > ARTICLE_COVER_RETAINED_LIMIT
          )
            throw new Error('Invalid upload list');
          const uploads = value.map(parseArticleCoverUpload);
          if (
            uploads.some(
              (upload) =>
                upload.articleId !== articleId || upload.status === 'cancelled'
            ) ||
            new Set(uploads.map((item) => item.id)).size !== uploads.length
          )
            throw new Error('Unexpected upload list');
          return uploads;
        })
      )
    );
  }
  reserve(input: ArticleCoverUploadInput, key: string) {
    return this.receipt(
      this.http.post<unknown>(this.images, input, {
        headers: { 'Idempotency-Key': key },
      }),
      null,
      1,
      'pending'
    );
  }
  read(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.images}/${articleCoverId(id)}`)
      ).pipe(
        map((value) => {
          const upload = parseArticleCoverUpload(value);
          if (upload.id !== id) throw new Error('Unexpected image identity');
          return upload;
        })
      )
    );
  }
  upload(id: string, revision: number, file: File, key: string) {
    return this.receipt(
      defer(() =>
        this.http.put<unknown>(
          `${this.images}/${articleCoverId(id)}/content`,
          file,
          {
            headers: {
              'Idempotency-Key': key,
              'If-Match': `"${articleCoverInteger(revision)}"`,
              'Content-Type': 'application/octet-stream',
            },
          }
        )
      ),
      id,
      revision + 1,
      'ready'
    );
  }
  cancel(id: string, revision: number, key: string) {
    return this.receipt(
      defer(() =>
        this.http.delete<unknown>(`${this.images}/${articleCoverId(id)}`, {
          body: { expectedRevision: revision },
          headers: { 'Idempotency-Key': key },
        })
      ),
      id,
      revision + 1,
      'cancelled'
    );
  }
  preview(target: ArticleCoverPreview) {
    return this.result(
      defer(() => {
        const id = articleCoverId(target.id);
        const url =
          target.kind === 'upload'
            ? `${this.images}/${id}/content`
            : target.kind === 'published'
            ? `${this.origin}/api/media/articles/${id}/${articleCoverId(
                target.imageId
              )}`
            : `${
                target.review
                  ? this.origin + '/api/editorial/article-reviews'
                  : this.drafts
              }/${id}/submissions/${articleCoverInteger(
                target.revision
              )}/cover`;
        return this.http.get(url, { responseType: 'blob' });
      }).pipe(
        map((blob) => {
          if (
            blob.type !== 'image/webp' ||
            blob.size < 1 ||
            blob.size > ARTICLE_COVER_OUTPUT_LIMIT
          )
            throw new Error('Invalid cover bytes');
          return blob;
        })
      ),
      false,
      target.kind === 'published'
    );
  }
  private receipt(
    source: Observable<unknown>,
    id: string | null,
    revision: number,
    status: 'pending' | 'ready' | 'cancelled'
  ) {
    return this.result(
      source.pipe(
        map((value) => {
          const receipt = parseArticleCoverUploadReceipt(value);
          if (
            (id && receipt.id !== id) ||
            receipt.revision !== revision ||
            receipt.status !== status
          )
            throw new Error('Unexpected upload receipt');
          return receipt;
        })
      ),
      true
    );
  }
  private result<T>(
    source: Observable<T>,
    mutation = false,
    publicRead = false
  ): Observable<Result<T, Error>> {
    const session = this.session.currentKey();
    return defer(() => {
      if (!publicRead && (!session || session !== this.session.currentKey()))
        throw new ArticleRequestError(
          'The account changed. Reopen article covers.',
          false,
          401
        );
      return source;
    }).pipe(
      map(ok),
      catchError((error: unknown) => {
        if (error instanceof ArticleRequestError) return of(err(error));
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const uncertain =
          mutation &&
          ![400, 401, 403, 404, 409, 413, 415, 422, 429].includes(status);
        const message =
          status === 409
            ? 'The draft or image changed, or this image is still referenced. Reload its current state before continuing.'
            : status === 404
            ? 'This draft or image is no longer available to this account.'
            : [401, 403].includes(status)
            ? 'Sign in again to access article covers.'
            : status === 429
            ? 'The image upload or retry limit was reached. Cancel unused uploads or try again later.'
            : [400, 413, 415, 422].includes(status)
            ? 'Choose the exact reserved PNG, JPEG or WebP still image, up to 8 MiB and 20 million pixels. Reload an expired reservation.'
            : uncertain
            ? 'The image change could not be confirmed. Retry the same request.'
            : 'Article covers are unavailable. Try again.';
        return of(err(new ArticleRequestError(message, uncertain, status)));
      })
    );
  }
}
