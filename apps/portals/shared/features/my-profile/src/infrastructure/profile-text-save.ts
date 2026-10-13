import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  parseProfileUpdate,
  parseProfileUpdateReceipt,
  type CustomerProfileDto,
} from '@domains/customer/profiles';
import {
  ProfileSaveError,
  type ProfileSession,
} from '../application/profile-session.port';

export interface ProfileTextSaveState {
  attempt: { session: string; signature: string; key: string } | null;
}

export function saveProfileText(
  http: HttpClient,
  url: string,
  sessionPort: ProfileSession,
  state: ProfileTextSaveState,
  profile: CustomerProfileDto
) {
  return defer(() => {
    const session = sessionPort.currentKey();
    if (!session)
      throw new ProfileSaveError(
        'session',
        'Sign in again before saving your profile.'
      );
    const input = parseProfileUpdate({
      expectedRevision: profile.revision,
      name: profile.name,
      bio: profile.bio ?? null,
      location: profile.location ?? null,
      socialLinks: profile.socialLinks ?? {},
      contactEmail: profile.contactEmail ?? null,
    });
    const signature = JSON.stringify({ identityId: profile.id, input });
    if (
      state.attempt?.session !== session ||
      state.attempt?.signature !== signature
    )
      state.attempt = { session, signature, key: crypto.randomUUID() };
    return http
      .put<unknown>(url, input, {
        headers: { 'Idempotency-Key': state.attempt.key },
      })
      .pipe(
        map((response) => {
          const receipt = parseProfileUpdateReceipt(response);
          if (
            receipt.identityId !== profile.id ||
            receipt.revision !== input.expectedRevision + 1
          )
            throw new ProfileSaveError(
              'unavailable',
              'The service returned an unexpected save receipt. Reload your profile to check its saved state.'
            );
          return ok(true);
        })
      );
  }).pipe(
    catchError((error: unknown) => {
      if (error instanceof ProfileSaveError) return of(err(error));
      if (error instanceof HttpErrorResponse) {
        if (error.status === 409)
          return of(
            err(
              new ProfileSaveError(
                'conflict',
                'Your profile changed in another session. Your edits are still in this form. Reload the saved profile before trying again.'
              )
            )
          );
        if ([401, 403].includes(error.status))
          return of(
            err(
              new ProfileSaveError(
                'session',
                'Profile access is unavailable. Sign in again before saving.'
              )
            )
          );
        return of(
          err(
            new ProfileSaveError(
              'unavailable',
              'Could not confirm the save. Your edits are still in this form. Retry to confirm the same change.'
            )
          )
        );
      }
      return of(
        err(
          new ProfileSaveError(
            'invalid',
            error instanceof Error ? error.message : 'Invalid profile fields.'
          )
        )
      );
    })
  );
}
