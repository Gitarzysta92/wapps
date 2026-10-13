import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  catchError,
  concat,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
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
import {
  parseFavoriteTarget,
  type FavoriteKind,
} from '@domains/customer/favorites';
import { err, type Result } from '@sdk/kernel/standard';
import type { IMyFavoritesStateProvider } from './my-favorites-state-provider.port';
import { emptyFavorites, type MyFavoritesState } from './my-favorites.state';
import { MY_FAVORITES_PROVIDER } from './my-favorites-provider.token';
import {
  FAVORITES_MODE,
  FAVORITES_SESSION,
  FavoritesSaveError,
} from './favorites-session.port';

@Injectable()
export class MyFavoritesService implements IMyFavoritesStateProvider {
  readonly mode = inject(FAVORITES_MODE);
  private readonly provider = inject(MY_FAVORITES_PROVIDER);
  private readonly session = inject(FAVORITES_SESSION);
  private readonly reload$ = new Subject<void>();
  private busyVersion: number | null = null;
  private readonly source = new BehaviorSubject<MyFavoritesState>({
    isLoading: false,
    isError: false,
    isSaving: false,
    signedIn: false,
    sessionKey: null,
    sessionVersion: -1,
    context: null,
    data: emptyFavorites(),
  });
  readonly myFavorites$ = this.source.asObservable();

  constructor() {
    this.session.key$
      .pipe(
        distinctUntilChanged(),
        map((key, version) => ({ key, version })),
        switchMap(({ key, version }) => {
          const empty: MyFavoritesState = {
            isLoading: false,
            isError: false,
            isSaving: false,
            signedIn: key !== null,
            sessionKey: key,
            sessionVersion: version,
            context: null,
            data: emptyFavorites(),
          };
          return key === null
            ? of(empty)
            : this.reload$.pipe(
                startWith(undefined),
                switchMap(() =>
                  concat(
                    of({ ...empty, isLoading: true }),
                    defer(() => this.provider.getMyFavorites()).pipe(
                      map((result) =>
                        result.ok
                          ? {
                              ...empty,
                              data: result.value.data,
                              context: result.value,
                            }
                          : { ...empty, isError: true }
                      ),
                      catchError(() => of({ ...empty, isError: true }))
                    )
                  )
                )
              );
        }),
        takeUntilDestroyed()
      )
      .subscribe((state) =>
        this.source.next({
          ...state,
          isSaving: this.busyVersion === state.sessionVersion,
        })
      );
  }

  reload(): void {
    this.reload$.next();
  }
  getState(): MyFavoritesState {
    return this.source.value;
  }

  supports(kind: FavoriteKind, id: string): boolean {
    if (this.mode === 'demo') return id.length > 0;
    try {
      parseFavoriteTarget({ kind, id });
      return true;
    } catch {
      return false;
    }
  }

  addToFavorites(
    kind: FavoriteKind,
    id: string
  ): Observable<Result<boolean, Error>> {
    return this.change(kind, id, true);
  }
  removeFromFavorites(
    kind: FavoriteKind,
    id: string
  ): Observable<Result<boolean, Error>> {
    return this.change(kind, id, false);
  }
  isFavorite$(kind: FavoriteKind, id: string): Observable<boolean> {
    return this.myFavorites$.pipe(
      map((state) => state.data[kind].includes(id)),
      distinctUntilChanged()
    );
  }

  private change(
    kind: FavoriteKind,
    id: string,
    saved: boolean
  ): Observable<Result<boolean, Error>> {
    return defer(() => {
      const current = this.source.value;
      const context = current.context;
      const key = this.session.currentKey();
      if (
        key === null ||
        key !== current.sessionKey ||
        !context ||
        current.isLoading ||
        current.isError
      )
        return of(
          err(
            new FavoritesSaveError(
              'session',
              'Sign in and load favorites before changing them.'
            )
          )
        );
      if (this.busyVersion === current.sessionVersion)
        return of(
          err(
            new FavoritesSaveError(
              'conflict',
              'Wait for the current favorite change to finish.'
            )
          )
        );
      if (saved && !this.supports(kind, id))
        return of(
          err(
            new FavoritesSaveError(
              'invalid',
              'Favorites for this content are not available yet.'
            )
          )
        );
      this.busyVersion = current.sessionVersion;
      this.source.next({ ...current, isSaving: true });
      return race(
        concat(this.myFavorites$, NEVER).pipe(
          filter((state) => state.sessionVersion !== current.sessionVersion),
          take(1),
          map(() =>
            err(
              new FavoritesSaveError(
                'session',
                'Your session changed. Reload favorites to check their saved state.'
              )
            )
          )
        ),
        defer(() =>
          this.provider.change({
            identityId: context.identityId,
            expectedRevision: context.revision,
            target: { kind, id },
            saved,
          })
        ).pipe(
          catchError(() =>
            of(
              err(
                new FavoritesSaveError(
                  'unavailable',
                  'Could not confirm the change. Retry the same request.'
                )
              )
            )
          )
        )
      ).pipe(
        take(1),
        tap((result) => {
          if (
            result.ok &&
            result.value &&
            this.session.currentKey() === key &&
            this.source.value.sessionVersion === current.sessionVersion
          )
            this.reload();
        }),
        finalize(() => {
          if (this.busyVersion === current.sessionVersion)
            this.busyVersion = null;
          if (this.source.value.sessionVersion === current.sessionVersion)
            this.source.next({ ...this.source.value, isSaving: false });
        })
      );
    });
  }
}
