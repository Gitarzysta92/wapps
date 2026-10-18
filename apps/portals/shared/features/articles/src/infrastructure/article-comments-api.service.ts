import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { commentObject, publicCommentContent, publicCommentId, type PublicComment, type PublicCommentThread } from '@domains/community';
import {
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
  ArticleRequestError,
} from '../application/article-workspace.port';
import type {
  ArticleCommentCommand,
  ArticleCommentReceipt,
  ArticleCommentsPort,
} from '../application/article-comments.port';

function integer(input: unknown, minimum = 0): number {
  if (
    typeof input !== 'number' ||
    !Number.isSafeInteger(input) ||
    input < minimum
  )
    throw new Error('Invalid comment response');
  return input;
}
function nullableTime(input: unknown): number | null {
  return input === null ? null : integer(input);
}
function comment(input: unknown): PublicComment {
  const value = commentObject(input, [
    'id',
    'parentId',
    'depth',
    'content',
    'createdAt',
    'updatedAt',
    'editable',
    'removable',
  ]);
  const depth = integer(value['depth']);
  if (
    depth > 64 ||
    typeof value['editable'] !== 'boolean' ||
    typeof value['removable'] !== 'boolean'
  )
    throw new Error('Invalid comment response');
  const result = {
    id: publicCommentId(value['id']),
    parentId:
      value['parentId'] === null ? null : publicCommentId(value['parentId']),
    depth,
    content:
      value['content'] === null ? null : publicCommentContent(value['content']),
    createdAt: nullableTime(value['createdAt']),
    updatedAt: nullableTime(value['updatedAt']),
    editable: value['editable'],
    removable: value['removable'],
  };
  if (
    (result.content && result.createdAt === null) ||
    (!result.content &&
      (result.editable ||
        result.removable ||
        result.createdAt !== null ||
        result.updatedAt !== null))
  )
    throw new Error('Invalid removed comment response');
  return result;
}
function thread(input: unknown, rootOnly: boolean): PublicCommentThread {
  const value = commentObject(input, [
    'id',
    'revision',
    'replyCount',
    'comments',
  ]);
  if (
    !Array.isArray(value['comments']) ||
    !value['comments'].length ||
    value['comments'].length > (rootOnly ? 1 : 2000)
  )
    throw new Error('Invalid comment thread');
  const comments = value['comments'].map(comment),
    id = publicCommentId(value['id']);
  if (
    !comments[0].content ||
    comments[0].id !== id ||
    comments[0].depth !== 0 ||
    comments[0].parentId !== null ||
    new Set(comments.map((item) => item.id)).size !== comments.length
  )
    throw new Error('Invalid comment thread structure');
  const nodes = new Map(comments.map((item) => [item.id, item]));
  if (
    comments
      .slice(1)
      .some(
        (item) =>
          !item.parentId || nodes.get(item.parentId)?.depth !== item.depth - 1
      )
  )
    throw new Error('Invalid reply ancestry');
  const replyCount = integer(value['replyCount']);
  if (replyCount > 1999) throw new Error('Invalid reply count');
  return { id, revision: integer(value['revision'], 1), replyCount, comments };
}

@Injectable({ providedIn: 'root' })
export class ArticleCommentsApiService implements ArticleCommentsPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(ARTICLE_ORIGIN);
  private readonly session = inject(ARTICLE_SESSION);
  private base(id: string) {
    return `${this.origin}/api/article-comments/${publicCommentId(id)}`;
  }
  list(articleId: string, cursor: string | null) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(this.base(articleId), {
          params: cursor ? { cursor } : {},
        })
      ).pipe(
        map((input) => {
          const value = commentObject(input, ['items', 'next']);
          const next = value['next'];
          if (
            !Array.isArray(value['items']) ||
            value['items'].length > 10 ||
            !(
              next === null ||
              (typeof next === 'string' &&
                /^\d{1,16}\.[0-9a-f-]{36}$/.test(next))
            )
          )
            throw new Error('Invalid comment page');
          if (next !== null) publicCommentId(next.split('.')[1]);
          const items = value['items'].map((item) => thread(item, true));
          if (
            new Set(items.map((item) => item.id)).size !== items.length ||
            (next !== null && items.length !== 10)
          )
            throw new Error('Invalid comment page structure');
          return { items, next };
        })
      )
    );
  }
  read(articleId: string, id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.base(articleId)}/${publicCommentId(id)}`)
      ).pipe(
        map((input) => {
          const result = thread(input, false);
          if (result.id !== id) throw new Error('Unexpected comment thread');
          return result;
        })
      )
    );
  }
  change(command: ArticleCommentCommand, key: string) {
    const sessionKey = this.session.currentKey();
    return this.result(
      defer(() => {
        if (!sessionKey || sessionKey !== this.session.currentKey())
          throw new ArticleRequestError('Sign in to comment.', false, 401);
        let url: string, method: string, body: unknown;
        try {
          url = this.base(command.articleId);
          if (command.type === 'create') {
            method = 'POST';
            body = publicCommentContent(command.content);
          } else {
            url += `/${publicCommentId(command.id)}`;
            if (command.type === 'reply') {
              method = 'POST';
              url += '/replies';
              body = publicCommentContent(command.content);
            } else {
              method = command.type === 'edit' ? 'PUT' : 'DELETE';
              body = {
                expectedRevision: integer(command.expectedRevision, 1),
                ...(command.type === 'edit'
                  ? { content: publicCommentContent(command.content) }
                  : {}),
              };
            }
          }
        } catch (error) {
          throw new ArticleRequestError(
            error instanceof Error ? error.message : 'Check your comment.',
            false,
            400
          );
        }
        return this.http.request<unknown>(method, url, {
          body,
          headers: { 'Idempotency-Key': key },
        });
      }).pipe(
        map((input): ArticleCommentReceipt => {
          const value = commentObject(input, [
            'id',
            'discussionId',
            'revision',
            'projection',
          ]);
          const id = publicCommentId(value['id']),
            discussionId = publicCommentId(value['discussionId']);
          const revision = integer(value['revision'], 1);
          if (
            value['projection'] !== 'pending' ||
            (command.type === 'create' &&
              (id !== discussionId || revision !== 1)) ||
            ((command.type === 'edit' || command.type === 'remove') &&
              (command.id !== id || revision !== command.expectedRevision + 1))
          )
            throw new Error('Unexpected comment receipt');
          return { id, discussionId, revision, projection: 'pending' };
        })
      ),
      true
    );
  }
  private result<T>(
    request: Observable<T>,
    mutation = false
  ): Observable<Result<T, Error>> {
    return request.pipe(
      map(ok),
      catchError((error: unknown) => {
        if (error instanceof ArticleRequestError) return of(err(error));
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const message =
          status === 401
            ? 'Sign in to comment.'
            : status === 403
            ? 'You cannot change this comment.'
            : status === 404
            ? 'The article or comment is no longer available.'
            : status === 409
            ? 'The thread changed. Reload comments before editing again; your text is still here.'
            : status === 400
            ? 'Check the public name, comment text and saved revision.'
            : mutation
            ? 'The comment change could not be confirmed. Retry the same request.'
            : 'Comments are unavailable or still updating. Try loading them again.';
        return of(
          err(
            new ArticleRequestError(
              message,
              mutation && (status === 0 || status >= 500),
              status
            )
          )
        );
      })
    );
  }
}
