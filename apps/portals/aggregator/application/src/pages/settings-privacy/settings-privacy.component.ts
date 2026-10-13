import { RouterLink } from '@angular/router';
import { Component, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import {
  AccountExportPanelComponent,
  AccountErasurePanelComponent,
  provideAccountExport,
} from '@portals/shared/features/identity';
import { API_BASE_URL } from '../../environment';
import {
  MY_PROFILE_MODE,
  MY_PROFILE_PROVIDER,
} from '@portals/shared/features/my-profile';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge } from '@taiga-ui/layout';
import {
  NavigationDeclarationDto,
  IBreadcrumbRouteData,
  routingDataConsumerFrom,
} from '@portals/shared/boundary/navigation';
import {
  PreferencesEditor,
  PreferencesService,
} from '@portals/shared/features/preferences';
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
  ProfileVisibility,
  DEFAULT_PRIVACY_PREFERENCES,
} from '@domains/customer/preferences';

@Component({
  selector: 'settings-privacy-page',
  templateUrl: 'settings-privacy.component.html',
  styleUrl: 'settings-privacy.component.scss',
  standalone: true,
  providers: [provideAccountExport(API_BASE_URL)],
  imports: [
    AccountExportPanelComponent,
    AccountErasurePanelComponent,
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
export class SettingsPrivacyPageComponent
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

  // Visibility options
  protected readonly visibilityOptions: {
    label: string;
    value: ProfileVisibility;
    description: string;
  }[] = [
    {
      label: 'Public',
      value: 'public',
      description: 'Anyone can see your profile',
    },
    {
      label: 'Followers Only',
      value: 'followers',
      description: 'Only followers you approve',
    },
    {
      label: 'Private',
      value: 'private',
      description: 'Only you can see your profile',
    },
  ];

  private readonly preferencesService = inject(PreferencesService);
  protected readonly privacyPreferences = computed(
    () => this.preferences().privacy
  );

  private readonly document = inject(DOCUMENT);
  private readonly profileProvider = inject(MY_PROFILE_PROVIDER);
  protected readonly includeLocalProfile =
    this.isDemo && inject(MY_PROFILE_MODE) === 'demo';
  protected readonly isExporting = signal(false);

  protected async onExport(): Promise<void> {
    if (
      this.isExporting() ||
      this.isLoading() ||
      this.isError() ||
      this.isGuest()
    )
      return;
    this.isExporting.set(true);
    this.saveError.set(false);
    const sessionVersion = this.preferencesService.state().sessionVersion;
    try {
      const [profile, preferences] = await Promise.all([
        this.includeLocalProfile
          ? firstValueFrom(this.profileProvider.getMyProfile())
          : Promise.resolve({ ok: true as const, value: null }),
        firstValueFrom(this.preferencesService.readSavedPreferences()),
      ]);
      if (sessionVersion !== this.preferencesService.state().sessionVersion)
        return;
      if (!profile.ok || !preferences.ok)
        throw new Error('Could not read saved data for the current session');
      const payload = {
        schemaVersion: 2,
        source: this.isDemo ? 'demo-browser' : 'account',
        exportedAt: new Date().toISOString(),
        scope: this.includeLocalProfile
          ? 'Profile and preferences available in this browser, including demo defaults where no local record exists. Excludes unsaved edits, remote account data, authentication credentials and other app data.'
          : this.isDemo
          ? 'Saved browser preferences only. Excludes profile, remote data, unsaved edits and authentication credentials.'
          : 'Saved account preferences only. Excludes account profile, other account data, unsaved edits, authentication credentials and other app data.',
        ...(this.includeLocalProfile ? { profile: profile.value } : {}),
        preferences: preferences.value,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        })
      );
      const link = this.document.createElement('a');
      try {
        link.href = url;
        link.download = this.isDemo
          ? 'wapps-local-settings.json'
          : 'wapps-account-preferences.json';
        this.document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        requestAnimationFrame(() => URL.revokeObjectURL(url));
      }
      this.feedback.set(
        this.includeLocalProfile
          ? 'Local profile and preferences export downloaded.'
          : this.isDemo
          ? 'Local preferences export downloaded.'
          : 'Saved account preferences export downloaded.'
      );
    } catch {
      if (sessionVersion !== this.preferencesService.state().sessionVersion)
        return;
      this.saveError.set(true);
      this.feedback.set(
        'Could not export saved settings. Check your session, connection and download permissions.'
      );
    } finally {
      this.isExporting.set(false);
    }
  }

  protected onVisibilityChange(profileVisibility: ProfileVisibility): void {
    this.editor.patch({ privacy: { profileVisibility } });
  }
  protected onPrivacyToggle(
    key: Exclude<keyof typeof DEFAULT_PRIVACY_PREFERENCES, 'profileVisibility'>,
    value: boolean
  ): void {
    this.editor.patch({ privacy: { [key]: value } });
  }
  protected onSave(): Promise<void> {
    return this.editor.save({ privacy: this.privacyPreferences() });
  }
  protected onCancel(): void {
    this.editor.cancel();
  }
}
