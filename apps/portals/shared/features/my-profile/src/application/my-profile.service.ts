import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  concat,
  defer,
  distinctUntilChanged,
  filter,
  map,
  NEVER,
  Observable,
  of,
  race,
  startWith,
  Subject,
  switchMap,
  take,
  tap,
} from 'rxjs';
import type { CustomerProfileDto } from '@domains/customer/profiles';
import { err, type Result } from '@sdk/kernel/standard';
import {
  MY_PROFILE_PROVIDER,
  MY_PROFILE_UPDATER,
} from './my-profile-provider.tokens';
import type { IMyProfileStateProvider } from './my-profile-state-provider.port';
import type { MyProfileState } from './my-profile.state';
import {
  MY_PROFILE_MODE,
  PROFILE_SESSION,
  ProfileSaveError,
} from './profile-session.port';

@Injectable()
export class MyProfileService implements IMyProfileStateProvider {
  private readonly provider = inject(MY_PROFILE_PROVIDER);
  private readonly updater = inject(MY_PROFILE_UPDATER);
  private readonly session = inject(PROFILE_SESSION);
  readonly mode = inject(MY_PROFILE_MODE);
  private readonly reload$ = new Subject<void>();
  private readonly state = new BehaviorSubject<MyProfileState>({
    isLoading: false,
    isError: false,
    data: null,
  });
  readonly myProfile$ = this.state.asObservable();

  constructor() {
    this.session.key$
      .pipe(
        distinctUntilChanged(),
        switchMap((key) =>
          key === null
            ? of({ isLoading: false, isError: false, data: null })
            : this.reload$.pipe(
                startWith(undefined),
                switchMap(() =>
                  concat(
                    of({ isLoading: true, isError: false, data: null }),
                    defer(() => this.provider.getMyProfile()).pipe(
                      map((result) => ({
                        isLoading: false,
                        isError: !result.ok,
                        data: result.ok ? result.value : null,
                      })),
                      catchError(() =>
                        of({ isLoading: false, isError: true, data: null })
                      )
                    )
                  )
                )
              )
        ),
        takeUntilDestroyed()
      )
      .subscribe((state) => this.state.next(state));
  }

  reload(): void {
    this.reload$.next();
  }

  updateProfile(
    profile: CustomerProfileDto
  ): Observable<Result<boolean, Error>> {
    return defer(() => {
      const key = this.session.currentKey();
      const current = this.getMyProfile();
      if (
        key === null ||
        !current ||
        current.id !== profile.id ||
        (this.mode === 'api' && current.revision !== profile.revision)
      )
        return of(
          err(
            new ProfileSaveError(
              'session',
              'The loaded account changed. Reload your profile before saving.'
            )
          )
        );
      if (
        this.mode === 'api' &&
        (current.avatar?.uri ?? null) !== (profile.avatar?.uri ?? null)
      )
        return of(
          err(
            new ProfileSaveError(
              'invalid',
              'Use the photo controls to change your photo separately.'
            )
          )
        );
      return race(
        concat(this.session.key$, NEVER).pipe(
          filter((next) => next !== key),
          take(1),
          map(() =>
            err(
              new ProfileSaveError(
                'session',
                'Your session changed. Reload your profile to check its saved state.'
              )
            )
          )
        ),
        this.updater.update(profile)
      ).pipe(
        take(1),
        tap((result) => {
          if (result.ok && result.value && this.session.currentKey() === key)
            this.reload();
        })
      );
    });
  }

  getProfile(): Observable<CustomerProfileDto | null> {
    return this.myProfile$.pipe(map((state) => state.data));
  }
  getMyProfile(): CustomerProfileDto | null {
    return this.state.value.data;
  }
}
