import { toSignal } from '@angular/core/rxjs-interop';
import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, Subject, tap, startWith, switchMap, shareReplay } from 'rxjs';
import { 
  CUSTOMER_PREFERENCES_PROVIDER, 
  CUSTOMER_PREFERENCES_UPDATER,
  CustomerPreferencesDto,
  DEFAULT_CUSTOMER_PREFERENCES,
  DisplayPreferencesDto,
  ContentPreferencesDto,
  NotificationPreferencesDto,
  PrivacyPreferencesDto,
  AccessibilityPreferencesDto
} from '@domains/customer/preferences';
import { Result } from '@foundation/standard';
import { IPreferencesStateProvider } from './preferences-state-provider.port';
import { PreferencesState } from './preferences.state';

@Injectable()
export class PreferencesService implements IPreferencesStateProvider {
  private readonly _preferencesProvider = inject(CUSTOMER_PREFERENCES_PROVIDER);
  private readonly _preferencesUpdater = inject(CUSTOMER_PREFERENCES_UPDATER);
  private readonly _preferencesUpdated$ = new Subject<void>();

  private readonly _state = signal<PreferencesState>({
    isLoading: true,
    isError: false,
    data: DEFAULT_CUSTOMER_PREFERENCES
  });

  public readonly state = this._state.asReadonly();
  public readonly display = computed(() => this._state().data.display);
  public readonly defaultView = computed(() => this.display().defaultView);
  public readonly itemsPerPage = computed(() => this.display().itemsPerPage);
  public readonly dateFormat = computed(() => ({
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'YYYY-MM-DD': 'yyyy-MM-dd'
  }[this.display().dateFormat]));

  public readonly isLoading = computed(() => this._state().isLoading);
  public readonly isError = computed(() => this._state().isError);

  public preferences$: Observable<PreferencesState> = this._preferencesUpdated$.pipe(
    startWith(undefined),
    switchMap(() => this._preferencesProvider.getPreferences()),
    map(result => ({
      isLoading: false,
      isError: !result.ok,
      data: result.ok ? result.value : this._state().data
    })),
    tap(state => {
      this._state.set(state);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private readonly initialized = toSignal(this.preferences$);

  public updatePreferences(preferences: Partial<CustomerPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updatePreferences(preferences).pipe(
      tap(result => { if (result.ok && result.value) this._preferencesUpdated$.next(); })
    );
  }

  public updateDisplayPreferences(preferences: Partial<DisplayPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateDisplayPreferences(preferences).pipe(
      tap(result => { if (result.ok && result.value) this._preferencesUpdated$.next(); })
    );
  }

  public updateContentPreferences(preferences: Partial<ContentPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateContentPreferences(preferences).pipe(
      tap(result => { if (result.ok && result.value) this._preferencesUpdated$.next(); })
    );
  }

  public updateNotificationPreferences(preferences: Partial<NotificationPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateNotificationPreferences(preferences).pipe(
      tap(result => { if (result.ok && result.value) this._preferencesUpdated$.next(); })
    );
  }

  public updatePrivacyPreferences(preferences: Partial<PrivacyPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updatePrivacyPreferences(preferences).pipe(
      tap(result => { if (result.ok && result.value) this._preferencesUpdated$.next(); })
    );
  }

  public updateAccessibilityPreferences(preferences: Partial<AccessibilityPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateAccessibilityPreferences(preferences).pipe(
      tap(result => { if (result.ok && result.value) this._preferencesUpdated$.next(); })
    );
  }

  public getPreferences(): CustomerPreferencesDto {
    return this._state().data;
  }
}


