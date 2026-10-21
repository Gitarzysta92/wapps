import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';
import type { ExploreSelection } from '@domains/feed';
import {
  PreferencesService,
  PublicContentPreferencesService,
} from '@portals/shared/features/preferences';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';

interface FeedChoices {
  key: string;
  status: 'ready' | 'loading' | 'unavailable';
  selection: ExploreSelection;
}

/** One current-session choice contract for all API activity consumers. */
@Injectable({ providedIn: 'root' })
export class FeedChoicesService {
  private readonly preferences = inject(PreferencesService);
  private readonly content = inject(PublicContentPreferencesService);
  private readonly favorites = inject(MyFavoritesService);
  private readonly session = inject(AUTHENTICATION_SESSION);
  readonly changes$ = combineLatest([
    this.session.token$,
    this.preferences.preferences$,
    this.favorites.myFavorites$,
    this.content.changes$,
  ]).pipe(
    map(() => this.read()),
    distinctUntilChanged((a, b) => a.key === b.key),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly observed = toSignal(this.changes$, { requireSync: true });

  current(): FeedChoices {
    this.observed();
    return this.read();
  }

  matches(key: string | null): boolean {
    const current = this.current();
    return current.status === 'ready' && current.key === key;
  }

  retry(): boolean {
    let retried = false;
    if (
      this.preferences.state().isError ||
      this.content.state().status === 'unavailable'
    ) {
      retried = true;
      this.preferences.reload();
    }
    if (this.usesFavorites() && this.favorites.getState().isError) {
      retried = true;
      this.favorites.reload();
    }
    return retried;
  }

  private usesFavorites() {
    const { content, privacy } = this.preferences.state().data;
    return (
      content.feedSortOrder === 'recommended' &&
      privacy.allowPersonalization &&
      this.session.getToken() !== null
    );
  }

  private read(): FeedChoices {
    const preferences = this.preferences.state();
    const favorites = this.favorites.getState();
    const choice = this.content.state();
    const token = this.session.getToken();
    const personal = this.usesFavorites();
    const { content, privacy } = preferences.data;
    let status: FeedChoices['status'] = 'ready';
    if (
      preferences.isLoading ||
      choice.status === 'loading' ||
      preferences.sessionKey !== token ||
      choice.sessionKey !== token ||
      preferences.sessionVersion !== choice.sessionVersion ||
      (choice.status === 'ready' &&
        choice.showMatureContent !== content.showMatureContent) ||
      (personal && favorites.isLoading)
    )
      status = 'loading';
    else if (
      preferences.isError ||
      !preferences.context ||
      choice.status === 'unavailable' ||
      (personal && favorites.isError)
    )
      status = 'unavailable';
    else if (
      personal &&
      (!favorites.context ||
        preferences.context.read.account?.identityId !==
          favorites.context.identityId)
    )
      status = 'loading';

    const keys = new Set<string>();
    if (personal && status === 'ready')
      for (const [kind, ids] of Object.entries(favorites.data))
        for (const id of ids) keys.add(`${kind.slice(0, -1)}:${id}`);
    const selection: ExploreSelection = {
      order: content.feedSortOrder,
      personalize: privacy.allowPersonalization,
      ...content.contentFilters,
      showMatureContent: choice.showMatureContent,
      favorites: keys,
    };
    return {
      status,
      selection,
      key: JSON.stringify([
        token,
        preferences.sessionVersion,
        status,
        selection,
        personal ? favorites.context?.identityId : null,
        [...keys].sort(),
      ]),
    };
  }
}
