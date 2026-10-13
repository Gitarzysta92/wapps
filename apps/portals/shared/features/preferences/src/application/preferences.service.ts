import { computed, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import {
  defaultAccountPreferences,
  type CustomerPreferencesDto,
  type DisplayPreferencesDto,
  type ContentPreferencesDto,
  type NotificationPreferencesDto,
  type PrivacyPreferencesDto,
  type AccessibilityPreferencesDto,
  type PreferencesPatch,
} from '@domains/customer/preferences';
import { err, type Result } from '@sdk/kernel/standard';
import type { IPreferencesStateProvider } from './preferences-state-provider.port';
import type { PreferencesState } from './preferences.state';
import {
  GUEST_PREFERENCES_PORT,
  PREFERENCES_MODE,
  PREFERENCES_PORT,
  PREFERENCES_SESSION,
  PreferencesSaveError,
  type PreferencesEditContext,
} from './preferences-session.port';

@Injectable()
export class PreferencesService implements IPreferencesStateProvider {
  readonly mode = inject(PREFERENCES_MODE);
  private readonly port = inject(PREFERENCES_PORT);
  private readonly guest = inject(GUEST_PREFERENCES_PORT);
  private readonly session = inject(PREFERENCES_SESSION);
  private readonly reload$ = new Subject<void>();
  private readonly source = new BehaviorSubject<PreferencesState>({
    isLoading: true,
    isError: false,
    data: defaultAccountPreferences(),
    scope: this.mode === 'demo' ? 'demo' : 'guest',
    sessionKey: null,
    sessionVersion: -1,
    context: null,
  });
  readonly preferences$ = this.source.asObservable();
  readonly state = toSignal(this.preferences$, { requireSync: true });
  readonly display = computed(() => this.state().data.display);
  readonly defaultView = computed(() => this.display().defaultView);
  readonly itemsPerPage = computed(() => this.display().itemsPerPage);
  readonly dateFormat = computed(
    () =>
      ({
        'DD/MM/YYYY': 'dd/MM/yyyy',
        'MM/DD/YYYY': 'MM/dd/yyyy',
        'YYYY-MM-DD': 'yyyy-MM-dd',
      }[this.display().dateFormat])
  );
  readonly isLoading = computed(() => this.state().isLoading);
  readonly isError = computed(() => this.state().isError);
  readonly scope = computed(() => this.state().scope);

  constructor() {
    this.session.key$
      .pipe(
        distinctUntilChanged(),
        map((key, version) => ({ key, version })),
        switchMap(({ key, version }) =>
          this.reload$.pipe(
            startWith(undefined),
            switchMap(() => {
              const scope =
                this.mode === 'demo'
                  ? 'demo'
                  : key === null
                  ? 'guest'
                  : 'account';
              const defaults: PreferencesState = {
                isLoading: true,
                isError: false,
                data: defaultAccountPreferences(),
                scope,
                sessionKey: key,
                sessionVersion: version,
                context: null,
              };
              const previous = this.source.value;
              const loading =
                previous.sessionVersion === version && previous.scope === scope
                  ? { ...defaults, data: previous.data }
                  : defaults;
              const port = scope === 'guest' ? this.guest : this.port;
              return concat(
                of(loading),
                defer(() => port.read()).pipe(
                  map((result) =>
                    result.ok
                      ? {
                          ...defaults,
                          isLoading: false,
                          data: result.value.data,
                          context: {
                            sessionKey: key,
                            sessionVersion: version,
                            read: result.value,
                          },
                        }
                      : { ...defaults, isLoading: false, isError: true }
                  ),
                  catchError(() =>
                    of({ ...defaults, isLoading: false, isError: true })
                  )
                )
              );
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((state) => this.source.next(state));
  }

  reload(): void {
    this.reload$.next();
  }
  getPreferences(): CustomerPreferencesDto {
    return this.state().data;
  }

  updatePreferences(
    patch: PreferencesPatch,
    context: PreferencesEditContext | null = this.state().context
  ): Observable<Result<boolean, Error>> {
    return defer(() => {
      const current = this.state();
      if (
        !context ||
        context.sessionVersion !== current.sessionVersion ||
        context.sessionKey !== this.session.currentKey() ||
        context.sessionKey !== current.sessionKey
      )
        return of(
          err(
            new PreferencesSaveError(
              'session',
              'Your session changed. Reload your settings before saving.'
            )
          )
        );
      if (current.context !== context)
        return of(
          err(
            new PreferencesSaveError(
              'conflict',
              'Your saved settings were reloaded or changed. Your edits are still in this form. Reload the saved settings before trying again.'
            )
          )
        );
      const port = current.scope === 'guest' ? this.guest : this.port;
      return race(
        concat(this.session.key$, NEVER).pipe(
          filter((key) => key !== context.sessionKey),
          take(1),
          map(() =>
            err(
              new PreferencesSaveError(
                'session',
                'Your session changed. Reload your settings to check the saved state.'
              )
            )
          )
        ),
        defer(() => port.save(context.read, patch, context.sessionKey))
      ).pipe(
        take(1),
        catchError(() =>
          of(
            err(
              new PreferencesSaveError(
                'unavailable',
                'Could not confirm the save. Retry or reload your saved settings.'
              )
            )
          )
        ),
        tap((result) => {
          if (
            result.ok &&
            result.value &&
            this.session.currentKey() === context.sessionKey
          )
            this.reload();
        })
      );
    });
  }

  readSavedPreferences(): Observable<Result<CustomerPreferencesDto, Error>> {
    return defer(() => {
      const key = this.session.currentKey();
      const port = this.mode === 'api' && key === null ? this.guest : this.port;
      return race(
        concat(this.session.key$, NEVER).pipe(
          filter((next) => next !== key),
          take(1),
          map(() => err(new Error('Session changed during export. Try again.')))
        ),
        port
          .read()
          .pipe(
            map((result) =>
              result.ok
                ? { ok: true as const, value: result.value.data }
                : result
            )
          )
      ).pipe(
        take(1),
        catchError(() =>
          of(err(new Error('Could not read saved preferences.')))
        )
      );
    });
  }

  updateDisplayPreferences(value: Partial<DisplayPreferencesDto>) {
    return this.updatePreferences({ display: value });
  }
  updateContentPreferences(value: Partial<ContentPreferencesDto>) {
    return this.updatePreferences({ content: value });
  }
  updateNotificationPreferences(value: Partial<NotificationPreferencesDto>) {
    return this.updatePreferences({ notifications: value });
  }
  updatePrivacyPreferences(value: Partial<PrivacyPreferencesDto>) {
    return this.updatePreferences({ privacy: value });
  }
  updateAccessibilityPreferences(value: Partial<AccessibilityPreferencesDto>) {
    return this.updatePreferences({ accessibility: value });
  }
}
