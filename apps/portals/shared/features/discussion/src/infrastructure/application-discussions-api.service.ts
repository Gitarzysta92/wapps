import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { commentObject, publicDiscussionReply, publicDiscussionTopic, discussionVoteState, discussionVoteChange, discussionPinChange, applicationDiscussionCursor, publicCommentId, type PublicComment, type PublicApplicationDiscussion } from '@domains/community';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  APPLICATION_DISCUSSION_ORIGIN,
  DiscussionRequestError,
} from '../application/application-discussions.port';
import type {
  ApplicationDiscussionCommand,
  ApplicationDiscussionReceipt,
  ApplicationDiscussionsPort,
} from '../application/application-discussions.port';

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
    'votes',
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
      value['content'] === null
        ? null
        : publicDiscussionReply(value['content']),
    createdAt: nullableTime(value['createdAt']),
    updatedAt: nullableTime(value['updatedAt']),
    editable: value['editable'],
    removable: value['removable'],
    votes: value['votes'] === null ? null : discussionVoteState(value['votes']),
  };
  if (
    (result.content && (result.createdAt === null || result.votes === null)) ||
    (!result.content &&
      (result.votes !== null ||
        result.editable ||
        result.removable ||
        result.createdAt !== null ||
        result.updatedAt !== null))
  )
    throw new Error('Invalid removed comment response');
  return result;
}
function thread(
  input: unknown,
  rootOnly: boolean
): PublicApplicationDiscussion {
  const value = commentObject(input, [
    'id',
    'revision',
    'replyCount',
    'comments',
    'title',
    'tags',
    'pinned',
    'canPin',
  ]);
  if (
    typeof value['pinned'] !== 'boolean' ||
    typeof value['canPin'] !== 'boolean' ||
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
  if (!rootOnly && replyCount !== comments.length - 1)
    throw new Error('Invalid reply count');
  const { title, tags } = publicDiscussionTopic({
    ...comments[0].content,
    title: value['title'],
    tags: value['tags'],
  });
  return {
    id,
    revision: integer(value['revision'], 1),
    replyCount,
    comments,
    title,
    tags,
    pinned: value['pinned'],
    canPin: value['canPin'],
  };
}

@Injectable()
export class ApplicationDiscussionsApiService
  implements ApplicationDiscussionsPort
{
  private readonly http = inject(HttpClient);
  private readonly origin = inject(APPLICATION_DISCUSSION_ORIGIN);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private base(id: string) {
    return `${this.origin}/api/application-discussions/${publicCommentId(id)}`;
  }
  list(applicationId: string, cursor: string | null) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(this.base(applicationId), {
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
                /^[01]\.\d{1,16}\.[0-9a-f-]{36}$/.test(next))
            )
          )
            throw new Error('Invalid comment page');
          if (next !== null) applicationDiscussionCursor(next);
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
  read(applicationId: string, id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.base(applicationId)}/${publicCommentId(id)}`
        )
      ).pipe(
        map((input) => {
          const result = thread(input, false);
          if (result.id !== id) throw new Error('Unexpected comment thread');
          return result;
        })
      )
    );
  }
  change(command: ApplicationDiscussionCommand, key: string) {
    const sessionKey = this.session.getToken();
    return this.result(
      defer(() => {
        if (!sessionKey || sessionKey !== this.session.getToken())
          throw new DiscussionRequestError(
            'Sign in to join the discussion.',
            false,
            401
          );
        let url: string, method: string, body: unknown;
        try {
          url = this.base(command.applicationId);
          if (command.type === 'create') {
            method = 'POST';
            body = publicDiscussionTopic(command.content);
          } else {
            url += `/${publicCommentId(command.id)}`;
            if (command.type === 'reply') {
              method = 'POST';
              url += '/replies';
              body = publicDiscussionReply(command.content);
            } else if (command.type === 'pin') {
              method = 'PUT';
              url += '/pin';
              body = discussionPinChange({
                pinned: command.pinned,
                expectedRevision: command.expectedRevision,
              });
            } else if (command.type === 'vote') {
              method = 'PUT';
              url += '/vote';
              body = discussionVoteChange({
                expectedRevision: command.expectedRevision,
                value: command.value,
              });
            } else {
              method = command.type === 'edit' ? 'PUT' : 'DELETE';
              body = {
                expectedRevision: integer(command.expectedRevision, 1),
                ...(command.type === 'edit'
                  ? {
                      content: command.root
                        ? publicDiscussionTopic(command.content)
                        : publicDiscussionReply(command.content),
                    }
                  : {}),
              };
            }
          }
        } catch (error) {
          throw new DiscussionRequestError(
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
        map((input): ApplicationDiscussionReceipt => {
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
            ((command.type === 'edit' ||
              command.type === 'remove' ||
              command.type === 'pin' ||
              command.type === 'vote') &&
              (command.id !== id || revision !== command.expectedRevision + 1))
          )
            throw new Error('Unexpected comment receipt');
          return { id, discussionId, revision, projection: 'pending' };
        })
      ),
      true,
      command.type === 'vote' || command.type === 'pin'
        ? command.type
        : undefined
    );
  }
  private result<T>(
    request: Observable<T>,
    mutation = false,
    operation?: 'vote' | 'pin'
  ): Observable<Result<T, Error>> {
    return request.pipe(
      map(ok),
      catchError((error: unknown) => {
        if (error instanceof DiscussionRequestError) return of(err(error));
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const message =
          status === 401
            ? 'Sign in to join the discussion.'
            : status === 403
            ? 'You cannot change this post.'
            : status === 404
            ? 'The application or discussion is no longer available.'
            : status === 409
            ? operation === 'pin'
              ? 'The thread changed. Reload the discussion before pinning again.'
              : operation === 'vote'
              ? 'The thread changed. Reload the discussion before voting again.'
              : 'The thread changed. Reload the discussion before editing again; your text is still here.'
            : status === 400
            ? operation
              ? 'Check the choice and saved thread revision.'
              : 'Check the public name, title, tags, text and saved revision.'
            : mutation
            ? 'The discussion change could not be confirmed. Retry the same request.'
            : 'Discussions are unavailable or still updating. Try loading them again.';
        return of(
          err(
            new DiscussionRequestError(
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
