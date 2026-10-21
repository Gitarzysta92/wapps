import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  concat,
  defer,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { permitsContent } from '@domains/publication/classification';
import {
  PreferencesService,
  PublicContentPreferencesService,
} from '@portals/shared/features/preferences';
import {
  FAVORITE_CONTENT,
  unresolvedFavorites,
  type FavoriteContent,
} from './favorite-content.port';
import { FAVORITES_SESSION } from './favorites-session.port';
import { MyFavoritesService } from './my-favorites.service';
import { emptyFavorites, type MyFavoritesState } from './my-favorites.state';

interface FavoriteContentContext {
  key: string;
  state: MyFavoritesState;
  preferences: 'ready' | 'loading' | 'unavailable';
  showMatureContent: boolean;
}

@Injectable()
export class FavoriteContentService {
  private readonly favorites = inject(MyFavoritesService);
  private readonly content = inject(FAVORITE_CONTENT);
  private readonly session = inject(FAVORITES_SESSION);
  readonly mode = this.favorites.mode;
  private readonly preferences =
    this.mode === 'api' ? inject(PreferencesService) : null;
  private readonly choices =
    this.mode === 'api' ? inject(PublicContentPreferencesService) : null;
  private readonly source$ = combineLatest([
    this.favorites.myFavorites$,
    this.session.key$,
    this.preferences?.preferences$ ?? of(null),
    this.choices?.changes$ ?? of(null),
  ]).pipe(
    map(() => this.current()),
    distinctUntilChanged((a, b) => a.key === b.key),
    switchMap((context) => {
      const base = this.base(context);
      if (!context.state.context || context.preferences !== 'ready')
        return of({ key: context.key, view: base });
      return concat(
        of({
          ...base,
          contentLoading: true,
          items: unresolvedFavorites(context.state.data, 'loading'),
        }),
        defer(() => this.content.resolve(context.state.data)).pipe(
          map((result) => {
            if (!result.ok) return { ...base, contentError: true };
            const items = result.value.map(
              (item): FavoriteContent =>
                item.status === 'available' &&
                !permitsContent(item, context.showMatureContent)
                  ? {
                      kind: item.kind,
                      id: item.id,
                      name: 'Hidden by content preferences',
                      slug: null,
                      status: 'hidden',
                    }
                  : item
            );
            return {
              ...base,
              items,
              hidden: items.filter((item) => item.status === 'hidden').length,
            };
          }),
          catchError(() => of({ ...base, contentError: true }))
        )
      ).pipe(map((view) => ({ key: context.key, view })));
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly observed = toSignal(this.source$, { initialValue: null });

  // Mask synchronously while a new choice is propagating through stream readers.
  readonly view = computed(() => {
    const snapshot = this.observed();
    const current = this.current();
    return snapshot?.key === current.key ? snapshot.view : this.base(current);
  });
  readonly view$ = this.source$.pipe(map(() => this.view()));

  reload(): void {
    if (this.current().preferences === 'unavailable')
      this.preferences?.reload();
    this.favorites.reload();
  }

  private current(): FavoriteContentContext {
    const token = this.session.currentKey();
    const original = this.favorites.getState();
    const state =
      original.sessionKey === token
        ? original
        : {
            ...original,
            sessionKey: token,
            isLoading: token !== null,
            isError: false,
            signedIn: token !== null,
            context: null,
            data: emptyFavorites(),
          };
    const saved = this.preferences?.state();
    const choice = this.choices?.state();
    let preferences: FavoriteContentContext['preferences'] = 'ready';
    if (saved && choice) {
      if (
        saved.isLoading ||
        choice.status === 'loading' ||
        saved.sessionKey !== token ||
        choice.sessionKey !== token ||
        saved.sessionVersion !== choice.sessionVersion ||
        (choice.status === 'ready' &&
          choice.showMatureContent !== saved.data.content.showMatureContent)
      )
        preferences = 'loading';
      else if (
        saved.isError ||
        !saved.context ||
        choice.status === 'unavailable' ||
        (state.context &&
          saved.context.read.account?.identityId !== state.context.identityId)
      )
        preferences = 'unavailable';
    }
    const showMatureContent = choice?.showMatureContent ?? true;
    return {
      state,
      preferences,
      showMatureContent,
      key: JSON.stringify([
        token,
        state.sessionVersion,
        state.isLoading,
        state.isError,
        state.context?.identityId,
        state.context?.revision,
        saved?.sessionVersion,
        preferences,
        showMatureContent,
      ]),
    };
  }

  private base({ state, preferences }: FavoriteContentContext) {
    const hasReferences = !!state.context;
    return {
      isLoading: state.isLoading,
      isError: state.isError,
      signedIn: state.signedIn,
      data: state.data,
      contentLoading: false,
      contentError: false,
      preferencesLoading: hasReferences && preferences === 'loading',
      preferencesError: hasReferences && preferences === 'unavailable',
      hidden: 0,
      items: unresolvedFavorites(
        state.data,
        preferences === 'loading' ? 'loading' : 'unknown'
      ),
    };
  }
}
