import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiChip, TuiRadioList, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge, TuiForm, TuiHeader } from '@taiga-ui/layout';
import { NavigationDeclarationDto } from '@portals/shared/boundary/navigation';
import { PREFERENCES_STATE_PROVIDER } from '@portals/shared/features/preferences';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { BreadcrumbsComponent } from '@ui/breadcrumbs';
import {
  ThemePreference,
  DateFormatPreference,
  ViewModePreference,
  FeedSortPreference,
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_CONTENT_PREFERENCES
} from '@domains/customer/preferences';

@Component({
  selector: 'settings-preferences-page',
  templateUrl: 'settings-preferences.component.html',
  styleUrl: 'settings-preferences.component.scss',
  standalone: true,
  imports: [
    FormsModule,
    TuiAppearance,
    TuiButton,
    TuiCardLarge,
    TuiChip,
    TuiForm,
    TuiHeader,
    TuiIcon,
    TuiRadioList,
    TuiSwitch,
    TuiTextfield,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
  ]
})
export class SettingsPreferencesPageComponent {
  public readonly breadcrumb = input<NavigationDeclarationDto[]>([]);

  private readonly preferencesStateProvider = inject(PREFERENCES_STATE_PROVIDER);

  public readonly preferences = computed(() => this.preferencesStateProvider.state().data);
  public readonly isLoading = this.preferencesStateProvider.isLoading;
  public readonly isError = this.preferencesStateProvider.isError;

  // Theme options
  protected readonly themeOptions: { label: string; value: ThemePreference }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'System', value: 'auto' }
  ];

  // Date format options
  protected readonly dateFormatOptions: { label: string; value: DateFormatPreference }[] = [
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
  ];

  // View mode options
  protected readonly viewModeOptions: { label: string; value: ViewModePreference }[] = [
    { label: 'Grid', value: 'grid' },
    { label: 'List', value: 'list' }
  ];

  // Feed sort options
  protected readonly feedSortOptions: { label: string; value: FeedSortPreference }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Most Popular', value: 'popular' },
    { label: 'Recommended', value: 'recommended' }
  ];

  // Items per page options
  protected readonly itemsPerPageOptions = [10, 20, 50, 100];

  // Form state
  protected readonly displayPreferences = signal({ ...DEFAULT_DISPLAY_PREFERENCES });
  protected readonly contentPreferences = signal({ ...DEFAULT_CONTENT_PREFERENCES });

  // Saving state
  protected readonly isSaving = signal(false);

  protected onThemeChange(theme: ThemePreference): void {
    this.displayPreferences.update(prefs => ({ ...prefs, theme }));
  }

  protected onDateFormatChange(dateFormat: DateFormatPreference): void {
    this.displayPreferences.update(prefs => ({ ...prefs, dateFormat }));
  }

  protected onViewModeChange(defaultView: ViewModePreference): void {
    this.displayPreferences.update(prefs => ({ ...prefs, defaultView }));
  }

  protected onFeedSortChange(feedSortOrder: FeedSortPreference): void {
    this.contentPreferences.update(prefs => ({ ...prefs, feedSortOrder }));
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.displayPreferences.update(prefs => ({ ...prefs, itemsPerPage }));
  }

  protected onMatureContentToggle(showMatureContent: boolean): void {
    this.contentPreferences.update(prefs => ({ ...prefs, showMatureContent }));
  }

  protected onSave(): void {
    this.isSaving.set(true);
    // TODO: Implement save logic
    setTimeout(() => {
      this.isSaving.set(false);
    }, 1000);
  }

  protected onCancel(): void {
    // Reset form to original values
    this.displayPreferences.set({ ...DEFAULT_DISPLAY_PREFERENCES });
    this.contentPreferences.set({ ...DEFAULT_CONTENT_PREFERENCES });
  }
}

