import { DestroyRef, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  type CustomerProfileDto,
  type IMyProfileProvider,
  type IMyProfileUpdater,
} from '@domains/customer/profiles';
import { MY_PROFILE_API_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';
import { PROFILE_SESSION } from '../application/profile-session.port';

@Injectable()
export class MyProfileApiService
  implements IMyProfileProvider, IMyProfileUpdater
{
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(
    MY_PROFILE_API_BASE_URL_PROVIDER
  )}/api/me/profile`;
  private readonly session = inject(PROFILE_SESSION);
  private readonly saveState: import('./profile-text-save').ProfileTextSaveState =
    { attempt: null };
  private photoUrl: string | null = null;

  constructor() {
    this.session.key$
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.saveState.attempt = null;
        this.clearPhoto();
      });
    inject(DestroyRef).onDestroy(() => this.clearPhoto());
  }

  private clearPhoto(): void {
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photoUrl = null;
  }

  getMyProfile() {
    return defer(() => {
      this.clearPhoto();
      return this.http.get<unknown>(this.url);
    }).pipe(
      switchMap((value) =>
        import('./profile-response').then(({ parsePrivateProfile }) => parsePrivateProfile(value))
      ),
      switchMap((source) => {
        if (!source.profile.avatarId)
          return of({ source, uri: source.profile.avatarUri });
        return this.http
          .get(`${this.url}/avatar/${source.profile.avatarId}`, {
            responseType: 'blob',
          })
          .pipe(
            map((blob) => {
              if (
                blob.type !== 'image/webp' ||
                blob.size < 12 ||
                blob.size > 256 * 1024
              )
                throw new Error('Invalid profile photo');
              this.clearPhoto();
              this.photoUrl = URL.createObjectURL(blob);
              return { source, uri: this.photoUrl };
            })
          );
      }),
      map(({ source, uri }) => {
        const profile: CustomerProfileDto = {
          id: source.identityId,
          publicId: source.publicId,
          revision: source.revision,
          name: source.profile.name ?? '',
          bio: source.profile.bio ?? undefined,
          location: source.profile.location ?? undefined,
          contactEmail: source.profile.contactEmail ?? undefined,
          avatar: uri ? { uri, alt: source.profile.name ?? '' } : undefined,
          socialLinks: source.profile.socialLinks,
          joinedAt:
            source.registeredAt === null
              ? undefined
              : new Date(source.registeredAt),
        };
        return ok(profile);
      }),
      catchError(() =>
        of(err(new Error('Your profile could not be loaded. Try again.')))
      )
    );
  }

  update(profile: CustomerProfileDto) {
    return defer(() => import('./profile-text-save')).pipe(
      switchMap(({ saveProfileText }) =>
        saveProfileText(
          this.http,
          this.url,
          this.session,
          this.saveState,
          profile
        )
      ),
      catchError(() =>
        of(err(new Error('Profile saving is unavailable. Try again.')))
      )
    );
  }
}
