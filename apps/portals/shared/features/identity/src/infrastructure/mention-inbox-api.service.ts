import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, map, of, timeout } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import { commentObject, notificationTimestamp, publicCommentId, mentionInboxCursor, mentionInboxPage } from '@domains/community';
import {
  MENTION_INBOX_URL,
  type MentionInboxPort,
} from '../application/mention-inbox.port';

@Injectable()
export class MentionInboxApiService implements MentionInboxPort {
  private readonly http = inject(HttpClient);
  private readonly url =
    inject(MENTION_INBOX_URL) + '/api/me/notifications/mentions';
  list(cursor: string | null) {
    return defer(() => {
      mentionInboxCursor(cursor);
      return this.http.get<unknown>(this.url, {
        params: cursor === null ? {} : { cursor },
      });
    }).pipe(
      timeout(15_000),
      map((value) => ok(mentionInboxPage(value))),
      catchError((error) => of(err(this.failure(error))))
    );
  }
  markRead(id: string) {
    return defer(() =>
      this.http.put<unknown>(`${this.url}/read`, { id: publicCommentId(id) })
    ).pipe(
      timeout(15_000),
      map((value) => {
        const row = commentObject(value, ['id', 'readAt']);
        if (publicCommentId(row['id']) !== id)
          throw new Error('Notification receipt differs');
        return ok({ id, readAt: notificationTimestamp(row['readAt'], 1) });
      }),
      catchError((error) => of(err(this.failure(error))))
    );
  }
  private failure(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      if ([401, 403].includes(error.status))
        return new Error(
          'Notification access was denied. Check your sign-in and account status.'
        );
      if (error.status === 409)
        return new Error(
          'Your account changed while notifications were loading. Refresh to use your current settings.'
        );
      if (error.status === 400)
        return new Error(
          'This notification is unavailable or the request was rejected. Refresh your inbox.'
        );
    }
    return new Error(
      'Notifications could not be confirmed. Check your connection and try again.'
    );
  }
}
