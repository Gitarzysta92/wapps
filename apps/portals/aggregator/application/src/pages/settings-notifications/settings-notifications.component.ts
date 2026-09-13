import { RouterLink } from '@angular/router';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge } from '@taiga-ui/layout';
import { NavigationDeclarationDto, IBreadcrumbRouteData, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { PREFERENCES_STATE_PROVIDER, PreferencesService } from '@portals/shared/features/preferences';
import { PageHeaderComponent, PageTitleComponent, ContentStateComponent } from '@ui/layout';
import { SettingsNavigationComponent } from '../settings/settings-navigation.component';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
import {
  EmailNotificationFrequency,
  DEFAULT_NOTIFICATION_PREFERENCES
} from '@domains/customer/preferences';

@Component({
  selector: 'settings-notifications-page',
  templateUrl: 'settings-notifications.component.html',
  styleUrl: 'settings-notifications.component.scss',
  standalone: true,
  imports: [
    RouterLink,
    ContentStateComponent,
    SettingsNavigationComponent,
    FormsModule,
    TuiAppearance,
    TuiButton,
    TuiCardLarge,
    TuiSkeleton,
    TuiIcon,
    TuiSwitch,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
  ]
})
export class SettingsNotificationsPageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly preferencesStateProvider = inject(PREFERENCES_STATE_PROVIDER);

  public readonly preferences = computed(() => this.preferencesStateProvider.state().data);
  public readonly isLoading = this.preferencesStateProvider.isLoading;
  public readonly isError = this.preferencesStateProvider.isError;

  // Email frequency options
  protected readonly emailFrequencyOptions: { label: string; value: EmailNotificationFrequency }[] = [
    { label: 'Instant', value: 'instant' },
    { label: 'Daily Digest', value: 'daily' },
    { label: 'Weekly Digest', value: 'weekly' },
    { label: 'Never', value: 'never' }
  ];

  // Form state
  protected readonly emailPreferences = signal({ ...DEFAULT_NOTIFICATION_PREFERENCES.email });
  protected readonly inAppPreferences = signal({ ...DEFAULT_NOTIFICATION_PREFERENCES.inApp });
  protected readonly pushPreferences = signal({ ...DEFAULT_NOTIFICATION_PREFERENCES.push });

  public reload(): void { this.preferencesService.reload(); }

  private readonly preferencesService = inject(PreferencesService);
  protected readonly feedback = signal('');
  protected readonly saveError = signal(false);

  constructor() {
    effect(() => {
      const saved = this.preferences();
      this.emailPreferences.set(structuredClone(saved.notifications.email));
      this.inAppPreferences.set(structuredClone(saved.notifications.inApp));
      this.pushPreferences.set(structuredClone(saved.notifications.push));
    });
  }

  // Saving state
  protected readonly isSaving = signal(false);

  // Email preference handlers
  protected onEmailEnabledToggle(enabled: boolean): void {
    this.feedback.set('');
    this.emailPreferences.update(prefs => ({ ...prefs, enabled }));
  }

  protected onEmailFrequencyChange(frequency: EmailNotificationFrequency): void {
    this.feedback.set('');
    this.emailPreferences.update(prefs => ({ ...prefs, frequency }));
  }

  protected onEmailPreferenceToggle(key: keyof typeof DEFAULT_NOTIFICATION_PREFERENCES.email, value: boolean): void {
    this.feedback.set('');
    this.emailPreferences.update(prefs => ({ ...prefs, [key]: value }));
  }

  // In-app preference handlers
  protected onInAppEnabledToggle(enabled: boolean): void {
    this.feedback.set('');
    this.inAppPreferences.update(prefs => ({ ...prefs, enabled }));
  }

  protected onInAppPreferenceToggle(key: keyof typeof DEFAULT_NOTIFICATION_PREFERENCES.inApp, value: boolean): void {
    this.feedback.set('');
    this.inAppPreferences.update(prefs => ({ ...prefs, [key]: value }));
  }

  // Push preference handlers
  protected onPushEnabledToggle(enabled: boolean): void {
    this.feedback.set('');
    this.pushPreferences.update(prefs => ({ ...prefs, enabled }));
  }

  protected onPushCriticalOnlyToggle(criticalOnly: boolean): void {
    this.feedback.set('');
    this.pushPreferences.update(prefs => ({ ...prefs, criticalOnly }));
  }

  protected async onSave(): Promise<void> {
    if (this.isSaving() || this.isLoading()) return;
    this.isSaving.set(true);
    this.feedback.set('');
    this.saveError.set(false);
    try {
      const result = await firstValueFrom(this.preferencesService.updatePreferences({ notifications: { email: this.emailPreferences(), inApp: this.inAppPreferences(), push: this.pushPreferences() } }));
      if (!result.ok || !result.value) throw new Error('Save failed');
      this.feedback.set('Saved on this browser.');
    } catch {
      this.saveError.set(true);
      this.feedback.set('Could not save. Browser storage may be unavailable or full. Your changes are still in the form.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected onCancel(): void {
    const saved = this.preferences();
    this.emailPreferences.set(structuredClone(saved.notifications.email));
    this.inAppPreferences.set(structuredClone(saved.notifications.inApp));
    this.pushPreferences.set(structuredClone(saved.notifications.push));
    this.saveError.set(false);
    this.feedback.set('Restored saved settings.');
  }
}
