import type { ProfileArticlesPage } from '@domains/publication/article';
import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { PublicProfileFavoritesPage } from '@domains/customer/favorites';
import type { ProfileSuitesPage } from '@domains/publication/suite';
import type { ProfileDiscussionsPage } from '@domains/discussion/contracts';
import type {
  CustomerProfileDto,
  ProfileActivityPage,
  ProfileDirectory,
  ProfileFollow,
  ProfileFollowChange,
  ProfileFollowerList,
  ProfileFollowingList,
  PublicProfileView,
} from '@domains/customer/profiles';

export interface PublicProfileRead {
  view: PublicProfileView;
  profile: CustomerProfileDto | null;
}
export interface PublicProfilePort {
  articles(
    id: string,
    after: string | null
  ): Observable<Result<ProfileArticlesPage, PublicProfileError>>;
  activity(
    id: string,
    after: string | null
  ): Observable<Result<ProfileActivityPage, PublicProfileError>>;
  discussions(
    id: string,
    after: string | null
  ): Observable<Result<ProfileDiscussionsPage, PublicProfileError>>;
  suites(
    id: string,
    after: string | null
  ): Observable<Result<ProfileSuitesPage, PublicProfileError>>;
  read(id: string): Observable<Result<PublicProfileRead, PublicProfileError>>;
  favorites(
    id: string,
    after: string | null
  ): Observable<Result<PublicProfileFavoritesPage, PublicProfileError>>;
  directory(
    after: string | null
  ): Observable<Result<ProfileDirectory, PublicProfileError>>;
  followers(
    after: string | null
  ): Observable<Result<ProfileFollowerList, PublicProfileError>>;
  following(
    after: string | null
  ): Observable<Result<ProfileFollowingList, PublicProfileError>>;
  change(
    input: ProfileFollowChange,
    key: string
  ): Observable<Result<ProfileFollow, PublicProfileError>>;
  releasePhoto(): void;
}
export interface PublicProfileSession {
  key$: Observable<string | null>;
  currentKey(): string | null;
}
export class PublicProfileError extends Error {
  constructor(
    readonly reason:
      | 'missing'
      | 'conflict'
      | 'denied'
      | 'invalid'
      | 'unavailable',
    message: string
  ) {
    super(message);
  }
}
export const PUBLIC_PROFILE_PORT = new InjectionToken<PublicProfilePort>(
  'PUBLIC_PROFILE_PORT'
);
export const PUBLIC_PROFILE_API_URL = new InjectionToken<string>(
  'PUBLIC_PROFILE_API_URL'
);
export const PUBLIC_PROFILE_SESSION = new InjectionToken<PublicProfileSession>(
  'PUBLIC_PROFILE_SESSION'
);
