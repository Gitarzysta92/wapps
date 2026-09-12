import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { TuiAppearance, TuiButton, TuiIcon, TuiTextfield } from '@taiga-ui/core';
import { TuiSkeleton, TuiSwitch } from '@taiga-ui/kit';
import { TuiCardLarge } from '@taiga-ui/layout';
import { NavigationDeclarationDto, IBreadcrumbRouteData, routingDataConsumerFrom } from '@portals/shared/boundary/navigation';
import { PREFERENCES_STATE_PROVIDER, PreferencesService } from '@portals/shared/features/preferences';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { BreadcrumbsComponent, BreadcrumbsSkeletonComponent } from '@ui/breadcrumbs';
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
    TuiSkeleton,
    TuiIcon,
    TuiSwitch,
    TuiTextfield,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
  ]
})
export class SettingsPreferencesPageComponent implements routingDataConsumerFrom<IBreadcrumbRouteData> {
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

  private readonly preferencesService = inject(PreferencesService);
  protected readonly feedback = signal('');
  protected readonly saveError = signal(false);

  constructor() {
    effect(() => {
      const saved = this.preferences();
      this.displayPreferences.set(structuredClone(saved.display));
      this.contentPreferences.set(structuredClone(saved.content));
    });
  }

  // Saving state
  protected readonly isSaving = signal(false);

  protected onThemeChange(theme: ThemePreference): void {
    this.feedback.set('');
    this.displayPreferences.update(prefs => ({ ...prefs, theme }));
  }

  protected onDateFormatChange(dateFormat: DateFormatPreference): void {
    this.feedback.set('');
    this.displayPreferences.update(prefs => ({ ...prefs, dateFormat }));
  }

  protected onViewModeChange(defaultView: ViewModePreference): void {
    this.feedback.set('');
    this.displayPreferences.update(prefs => ({ ...prefs, defaultView }));
  }

  protected onFeedSortChange(feedSortOrder: FeedSortPreference): void {
    this.feedback.set('');
    this.contentPreferences.update(prefs => ({ ...prefs, feedSortOrder }));
  }

  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.feedback.set('');
    this.displayPreferences.update(prefs => ({ ...prefs, itemsPerPage }));
  }

  protected onMatureContentToggle(showMatureContent: boolean): void {
    this.feedback.set('');
    this.contentPreferences.update(prefs => ({ ...prefs, showMatureContent }));
  }

  protected async onSave(): Promise<void> {
    if (this.isSaving() || this.isLoading()) return;
    this.isSaving.set(true);
    this.feedback.set('');
    this.saveError.set(false);
    try {
      const result = await firstValueFrom(this.preferencesService.updatePreferences({ display: this.displayPreferences(), content: this.contentPreferences() }));
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
    this.displayPreferences.set(structuredClone(saved.display));
    this.contentPreferences.set(structuredClone(saved.content));
    this.saveError.set(false);
    this.feedback.set('Restored saved settings.');
  }
}
