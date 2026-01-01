import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, Subject, tap } from 'rxjs';
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
import { Result } from '@standard';
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
  public readonly isLoading = computed(() => this._state().isLoading);
  public readonly isError = computed(() => this._state().isError);

  public preferences$: Observable<PreferencesState> = this._preferencesProvider.getPreferences().pipe(
    map(result => result.ok ? result.value : DEFAULT_CUSTOMER_PREFERENCES),
    map(preferences => ({
      isLoading: false,
      isError: false,
      data: preferences
    })),
    tap(state => {
      this._state.set(state);
    })
  );

  public updateDisplayPreferences(preferences: Partial<DisplayPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateDisplayPreferences(preferences).pipe(
      tap(() => this._preferencesUpdated$.next())
    );
  }

  public updateContentPreferences(preferences: Partial<ContentPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateContentPreferences(preferences).pipe(
      tap(() => this._preferencesUpdated$.next())
    );
  }

  public updateNotificationPreferences(preferences: Partial<NotificationPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateNotificationPreferences(preferences).pipe(
      tap(() => this._preferencesUpdated$.next())
    );
  }

  public updatePrivacyPreferences(preferences: Partial<PrivacyPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updatePrivacyPreferences(preferences).pipe(
      tap(() => this._preferencesUpdated$.next())
    );
  }

  public updateAccessibilityPreferences(preferences: Partial<AccessibilityPreferencesDto>): Observable<Result<boolean, Error>> {
    return this._preferencesUpdater.updateAccessibilityPreferences(preferences).pipe(
      tap(() => this._preferencesUpdated$.next())
    );
  }

  public getPreferences(): CustomerPreferencesDto {
    return this._state().data;
  }
}


