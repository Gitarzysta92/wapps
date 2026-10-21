import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { PreferencesService } from './preferences.service';
import { PREFERENCES_SESSION } from './preferences-session.port';

export interface PublicContentChoice {
  status: 'loading' | 'unavailable' | 'ready';
  sessionKey: string | null;
  sessionVersion: number;
  showMatureContent: boolean;
}

export class PublicContentReadError extends Error {
  constructor(readonly reason: 'loading' | 'preferences' | 'hidden') {
    super(
      reason === 'loading'
        ? 'Loading content preferences...'
        : reason === 'preferences'
        ? 'Your content preferences could not be loaded.'
        : 'This content is hidden by your content preferences.'
    );
  }
}

export function requireContentChoice(choice: PublicContentChoice | null) {
  if (choice && choice.status !== 'ready')
    throw new PublicContentReadError(
      choice.status === 'loading' ? 'loading' : 'preferences'
    );
  return choice?.showMatureContent ?? true;
}

/** Only a completed preference read for the current session can reveal content. */
@Injectable({ providedIn: 'root' })
export class PublicContentPreferencesService {
  private readonly preferences = inject(PreferencesService);
  private readonly session = inject(PREFERENCES_SESSION);
  readonly changes$ = combineLatest([
    this.preferences.preferences$,
    this.session.key$,
  ]).pipe(
    map(([preferences, key]): PublicContentChoice => {
      const current =
        key === this.session.currentKey() &&
        key === preferences.sessionKey &&
        preferences.sessionVersion >= 0;
      const status =
        !current || preferences.isLoading
          ? 'loading'
          : preferences.isError || !preferences.context
          ? 'unavailable'
          : 'ready';
      return {
        status,
        sessionKey: key,
        sessionVersion: preferences.sessionVersion,
        showMatureContent:
          status === 'ready' && preferences.data.content.showMatureContent,
      };
    }),
    distinctUntilChanged(
      (previous, next) =>
        previous.status === next.status &&
        previous.sessionKey === next.sessionKey &&
        previous.sessionVersion === next.sessionVersion &&
        previous.showMatureContent === next.showMatureContent
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly state = toSignal(this.changes$, {
    initialValue: {
      status: 'loading',
      sessionKey: null,
      sessionVersion: -1,
      showMatureContent: false,
    } satisfies PublicContentChoice,
  });

  reload() {
    this.preferences.reload();
  }
}
