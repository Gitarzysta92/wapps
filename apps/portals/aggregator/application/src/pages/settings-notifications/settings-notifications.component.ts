import { RouterLink } from '@angular/router';
import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge } from '@taiga-ui/layout';
import {
  NavigationDeclarationDto,
  IBreadcrumbRouteData,
  routingDataConsumerFrom,
} from '@portals/shared/boundary/navigation';
import { PreferencesEditor } from '@portals/shared/features/preferences';
import {
  PageHeaderComponent,
  PageTitleComponent,
  ContentStateComponent,
} from '@ui/layout';
import { SettingsNavigationComponent } from '../settings/settings-navigation.component';
import {
  BreadcrumbsComponent,
  BreadcrumbsSkeletonComponent,
} from '@ui/breadcrumbs';
import {
  EmailNotificationFrequency,
  EmailNotificationPreferencesDto,
  InAppNotificationPreferencesDto,
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
  ],
})
export class SettingsNotificationsPageComponent
  implements routingDataConsumerFrom<IBreadcrumbRouteData>
{
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly editor = new PreferencesEditor();
  public readonly preferences = computed(() => this.editor.data());
  public readonly isLoading = this.editor.service.isLoading;
  public readonly isError = this.editor.service.isError;
  protected readonly isGuest = this.editor.isGuest;
  protected readonly isDemo = this.editor.isDemo;
  protected readonly feedback = this.editor.feedback;
  protected readonly saveError = this.editor.saveError;
  protected readonly isSaving = this.editor.isSaving;
  protected readonly conflict = this.editor.conflict;
  public reload(): void {
    this.editor.reload();
  }

  // Email frequency options
  protected readonly emailFrequencyOptions: {
    label: string;
    value: EmailNotificationFrequency;
  }[] = [
    { label: 'Instant', value: 'instant' },
    { label: 'Daily Digest', value: 'daily' },
    { label: 'Weekly Digest', value: 'weekly' },
    { label: 'Never', value: 'never' },
  ];

  protected readonly emailPreferences = computed(
    () => this.preferences().notifications.email
  );
  protected readonly inAppPreferences = computed(
    () => this.preferences().notifications.inApp
  );
  protected readonly pushPreferences = computed(
    () => this.preferences().notifications.push
  );
  protected onEmailEnabledToggle(enabled: boolean): void {
    this.editor.patch({
      notifications: { email: { ...this.emailPreferences(), enabled } },
    });
  }
  protected onEmailFrequencyChange(
    frequency: EmailNotificationFrequency
  ): void {
    this.editor.patch({
      notifications: { email: { ...this.emailPreferences(), frequency } },
    });
  }
  protected onEmailPreferenceToggle(
    key: Exclude<keyof EmailNotificationPreferencesDto, 'frequency'>,
    value: boolean
  ): void {
    this.editor.patch({
      notifications: { email: { ...this.emailPreferences(), [key]: value } },
    });
  }
  protected onInAppEnabledToggle(enabled: boolean): void {
    this.editor.patch({
      notifications: { inApp: { ...this.inAppPreferences(), enabled } },
    });
  }
  protected onInAppPreferenceToggle(
    key: keyof InAppNotificationPreferencesDto,
    value: boolean
  ): void {
    this.editor.patch({
      notifications: { inApp: { ...this.inAppPreferences(), [key]: value } },
    });
  }
  protected onPushEnabledToggle(enabled: boolean): void {
    this.editor.patch({
      notifications: { push: { ...this.pushPreferences(), enabled } },
    });
  }
  protected onPushCriticalOnlyToggle(criticalOnly: boolean): void {
    this.editor.patch({
      notifications: { push: { ...this.pushPreferences(), criticalOnly } },
    });
  }
  protected onSave(): Promise<void> {
    return this.editor.save({
      notifications: this.preferences().notifications,
    });
  }
  protected onCancel(): void {
    this.editor.cancel();
  }
}
