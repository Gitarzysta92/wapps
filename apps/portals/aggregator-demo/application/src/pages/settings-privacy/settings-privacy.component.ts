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
  ProfileVisibility,
  DEFAULT_PRIVACY_PREFERENCES
} from '@domains/customer/preferences';

@Component({
  selector: 'settings-privacy-page',
  templateUrl: 'settings-privacy.component.html',
  styleUrl: 'settings-privacy.component.scss',
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
export class SettingsPrivacyPageComponent {
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

  // Saving state
  protected readonly isSaving = signal(false);

  protected onVisibilityChange(profileVisibility: ProfileVisibility): void {
    this.privacyPreferences.update(prefs => ({ ...prefs, profileVisibility }));
  }

  protected onPrivacyToggle(key: keyof typeof DEFAULT_PRIVACY_PREFERENCES, value: boolean): void {
    this.privacyPreferences.update(prefs => ({ ...prefs, [key]: value }));
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
    this.privacyPreferences.set({ ...DEFAULT_PRIVACY_PREFERENCES });
  }
}

