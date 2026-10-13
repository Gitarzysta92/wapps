import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, switchMap, throwError } from 'rxjs';
import {
  parseProfileAvatarChange,
  parseProfileUpdateReceipt,
  type ProfileAvatarChange,
} from '@domains/customer/profiles';
import type { ProfileAvatarPort } from '../application/profile-avatar.port';
import { MY_PROFILE_API_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';
import {
  PROFILE_SESSION,
  ProfileSaveError,
} from '../application/profile-session.port';

@Injectable()
export class ProfileAvatarApiService implements ProfileAvatarPort {
  private readonly http = inject(HttpClient);
  private readonly session = inject(PROFILE_SESSION);
  private readonly url = `${inject(
    MY_PROFILE_API_BASE_URL_PROVIDER
  )}/api/me/profile/avatar`;
  private attempt: { signature: string; key: string } | null = null;

  clear(): void {
    this.attempt = null;
  }

  change(identityId: string, revision: number, file: Blob | null) {
    return defer(async () => {
      const key = this.session.currentKey();
      if (!key)
        throw new ProfileSaveError(
          'session',
          'Sign in again before changing your photo.'
        );
      let source: ProfileAvatarChange['source'] = null;
      if (file) {
        if (
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size < 1 ||
          file.size > 2 * 1024 * 1024
        )
          throw new ProfileSaveError(
            'invalid',
            'Choose a PNG, JPEG or WebP image up to 2 MiB.'
          );
        const digest = await crypto.subtle.digest(
          'SHA-256',
          await file.arrayBuffer()
        );
        source = {
          contentType: file.type as NonNullable<
            ProfileAvatarChange['source']
          >['contentType'],
          bytes: file.size,
          sha256: Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0')
          ).join(''),
        };
      }
      const input = parseProfileAvatarChange({
        expectedRevision: revision,
        source,
      });
      if (this.session.currentKey() !== key)
        throw new ProfileSaveError(
          'session',
          'Your session changed. Reload your profile.'
        );
      const signature = JSON.stringify({ key, identityId, input });
      if (this.attempt?.signature !== signature)
        this.attempt = { signature, key: crypto.randomUUID() };
      return { input, commandKey: this.attempt.key };
    }).pipe(
      switchMap(({ input, commandKey }) => {
        const headers = {
          'Idempotency-Key': commandKey,
          'If-Match': `"${input.expectedRevision}"`,
        };
        return input.source && file
          ? this.http.put<unknown>(this.url, file, {
              headers: {
                ...headers,
                'Content-Type': input.source.contentType,
                'X-Avatar-Bytes': String(input.source.bytes),
                'X-Avatar-Sha256': input.source.sha256,
              },
            })
          : this.http.delete<unknown>(this.url, { headers });
      }),
      map((value) => {
        const receipt = parseProfileUpdateReceipt(value);
        if (
          receipt.identityId !== identityId ||
          receipt.revision !== revision + 1
        )
          throw new ProfileSaveError(
            'unavailable',
            'Unexpected photo receipt. Reload to check the saved photo.'
          );
        return receipt;
      }),
      catchError((error: unknown) => {
        if (error instanceof ProfileSaveError) return throwError(() => error);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        return throwError(
          () =>
            new ProfileSaveError(
              status === 409
                ? 'conflict'
                : [401, 403].includes(status)
                ? 'session'
                : [400, 413, 415].includes(status)
                ? 'invalid'
                : 'unavailable',
              status === 409
                ? 'Your profile changed. Reload the saved profile before trying again.'
                : [401, 403].includes(status)
                ? 'Photo access is unavailable. Sign in again.'
                : [400, 413, 415].includes(status)
                ? 'Use a still PNG, JPEG or WebP up to 2 MiB, 8192 pixels per side and 16 million pixels in total. Save your profile details first.'
                : 'Could not confirm the photo change. Retry the same change or reload to check what was saved.'
            )
        );
      })
    );
  }
}
