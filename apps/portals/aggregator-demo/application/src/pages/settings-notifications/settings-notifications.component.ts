import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiChip, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge, TuiHeader } from '@taiga-ui/layout';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { PREFERENCES_STATE_PROVIDER } from '@portals/shared/features/preferences';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
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
    FormsModule,
    TuiAppearance,
    TuiButton,
    TuiCardLarge,
    TuiChip,
    TuiHeader,
    TuiIcon,
    TuiSwitch,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ]
})
export class SettingsNotificationsPageComponent {
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

  // Saving state
  protected readonly isSaving = signal(false);

  // Email preference handlers
  protected onEmailEnabledToggle(enabled: boolean): void {
    this.emailPreferences.update(prefs => ({ ...prefs, enabled }));
  }

  protected onEmailFrequencyChange(frequency: EmailNotificationFrequency): void {
    this.emailPreferences.update(prefs => ({ ...prefs, frequency }));
  }

  protected onEmailPreferenceToggle(key: keyof typeof DEFAULT_NOTIFICATION_PREFERENCES.email, value: boolean): void {
    this.emailPreferences.update(prefs => ({ ...prefs, [key]: value }));
  }

  // In-app preference handlers
  protected onInAppEnabledToggle(enabled: boolean): void {
    this.inAppPreferences.update(prefs => ({ ...prefs, enabled }));
  }

  protected onInAppPreferenceToggle(key: keyof typeof DEFAULT_NOTIFICATION_PREFERENCES.inApp, value: boolean): void {
    this.inAppPreferences.update(prefs => ({ ...prefs, [key]: value }));
  }

  // Push preference handlers
  protected onPushEnabledToggle(enabled: boolean): void {
    this.pushPreferences.update(prefs => ({ ...prefs, enabled }));
  }

  protected onPushCriticalOnlyToggle(criticalOnly: boolean): void {
    this.pushPreferences.update(prefs => ({ ...prefs, criticalOnly }));
  }

  protected onSave(): void {
    this.isSaving.set(true);
    // TODO: Implement save logic
    setTimeout(() => {
      this.isSaving.set(false);
    }, 1000);
  }

  protected onCancel(): void {
    // Reset form to default values
    this.emailPreferences.set({ ...DEFAULT_NOTIFICATION_PREFERENCES.email });
    this.inAppPreferences.set({ ...DEFAULT_NOTIFICATION_PREFERENCES.inApp });
    this.pushPreferences.set({ ...DEFAULT_NOTIFICATION_PREFERENCES.push });
  }
}

