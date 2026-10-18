import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, timeout } from 'rxjs';
import {
  parseProfileDirectory,
  parsePublicProfileView,
} from '@domains/customer/profiles';
import { publicCommentId } from '@domains/community';
import { err, ok } from '@sdk/kernel/standard';
import {
  MENTION_MEMBERS_URL,
  type MentionMembersPort,
} from '../application/mention-members.port';

@Injectable()
export class MentionMembersApiService implements MentionMembersPort {
  private readonly http = inject(HttpClient);
  private readonly url = inject(MENTION_MEMBERS_URL) + '/api/profiles';
  directory(after: string | null) {
    return defer(() => {
      if (after !== null) publicCommentId(after);
      return this.http.get<unknown>(this.url, {
        params: after ? { after } : {},
      });
    }).pipe(
      timeout(10000),
      map((body) => {
        const page = parseProfileDirectory(body);
        if (
          after !== null &&
          (page.profiles.some((row) => row.id <= after) ||
            (page.after !== null && page.after <= after))
        )
          throw new Error('Invalid member page continuation');
        return ok({
          items: page.profiles.map(({ id, name }) => ({ id, name })),
          after: page.after,
        });
      }),
      catchError(() =>
        of(err(new Error('Members could not be loaded. Try again.')))
      )
    );
  }
  read(id: string) {
    return defer(() =>
      this.http.get<unknown>(`${this.url}/${publicCommentId(id)}`)
    ).pipe(
      timeout(10000),
      map((body) => {
        const view = parsePublicProfileView(body);
        if (view.profile && view.profile.id !== id)
          throw new Error('Member scope differs');
        return ok(view.profile ? { id, name: view.profile.name } : null);
      }),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(ok(null))
          : of(err(new Error('This member could not be checked. Try again.')))
      )
    );
  }
}
