import { RouterLink } from '@angular/router';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { MyProfileApiService } from '@portals/shared/features/my-profile';
import { PreferencesApiService } from '@portals/shared/features/preferences';
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
  ProfileVisibility,
  DEFAULT_PRIVACY_PREFERENCES
} from '@domains/customer/preferences';

@Component({
  selector: 'settings-privacy-page',
  templateUrl: 'settings-privacy.component.html',
  styleUrl: 'settings-privacy.component.scss',
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
export class SettingsPrivacyPageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly preferencesStateProvider = inject(PREFERENCES_STATE_PROVIDER);

  public readonly preferences = computed(() => this.preferencesStateProvider.state().data);
  public readonly isLoading = this.preferencesStateProvider.isLoading;
  public readonly isError = this.preferencesStateProvider.isError;

  // Visibility options
  protected readonly visibilityOptions: { label: string; value: ProfileVisibility; description: string }[] = [
    { label: 'Public', value: 'public', description: 'Anyone can see your profile' },
    { label: 'Followers Only', value: 'followers', description: 'Only people who follow you' },
    { label: 'Private', value: 'private', description: 'Only you can see your profile' }
  ];

  // Form state
  protected readonly privacyPreferences = signal({ ...DEFAULT_PRIVACY_PREFERENCES });

  public reload(): void { this.preferencesService.reload(); }

  private readonly preferencesService = inject(PreferencesService);
  protected readonly feedback = signal('');
  protected readonly saveError = signal(false);

  constructor() {
    effect(() => {
      const saved = this.preferences();
      this.privacyPreferences.set(structuredClone(saved.privacy));
    });
  }

  // Saving state
  protected readonly isSaving = signal(false);

  private readonly document = inject(DOCUMENT);
  private readonly profileApi = inject(MyProfileApiService);
  private readonly preferencesApi = inject(PreferencesApiService);
  protected readonly isExporting = signal(false);

  protected async onExport(): Promise<void> {
    if (this.isExporting()) return;
    this.isExporting.set(true);
    this.saveError.set(false);
    try {
      const [profile, preferences] = await Promise.all([
        firstValueFrom(this.profileApi.getMyProfile()),
        firstValueFrom(this.preferencesApi.getPreferences())
      ]);
      if (!profile.ok || !preferences.ok) throw new Error('Could not read local data');
      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        scope: 'Profile and preferences available in this browser, including demo defaults where no local record exists. Excludes unsaved edits, remote account data, authentication credentials and other app data.',
        profile: profile.value,
        preferences: preferences.value
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = this.document.createElement('a');
      try {
        link.href = url;
        link.download = 'wapps-local-settings.json';
        this.document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        requestAnimationFrame(() => URL.revokeObjectURL(url));
      }
      this.feedback.set('Local profile and preferences export downloaded.');
    } catch {
      this.saveError.set(true);
      this.feedback.set('Could not export local settings. Check browser storage and download permissions.');
    } finally {
      this.isExporting.set(false);
    }
  }

  protected onVisibilityChange(profileVisibility: ProfileVisibility): void {
    this.feedback.set('');
    this.privacyPreferences.update(prefs => ({ ...prefs, profileVisibility }));
  }

  protected onPrivacyToggle(key: keyof typeof DEFAULT_PRIVACY_PREFERENCES, value: boolean): void {
    this.feedback.set('');
    this.privacyPreferences.update(prefs => ({ ...prefs, [key]: value }));
  }

  protected async onSave(): Promise<void> {
    if (this.isSaving() || this.isLoading()) return;
    this.isSaving.set(true);
    this.feedback.set('');
    this.saveError.set(false);
    try {
      const result = await firstValueFrom(this.preferencesService.updatePreferences({ privacy: this.privacyPreferences() }));
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
    this.privacyPreferences.set(structuredClone(saved.privacy));
    this.saveError.set(false);
    this.feedback.set('Restored saved settings.');
  }
}
