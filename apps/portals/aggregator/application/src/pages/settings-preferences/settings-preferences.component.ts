import { RouterLink } from '@angular/router';
import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TuiAppearance,
  TuiButton,
  TuiIcon,
  TuiTextfield,
} from '@taiga-ui/core';
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
  ThemePreference,
  DateFormatPreference,
  ViewModePreference,
  FeedSortPreference,
} from '@domains/customer/preferences';

@Component({
  selector: 'settings-preferences-page',
  templateUrl: 'settings-preferences.component.html',
  styleUrl: 'settings-preferences.component.scss',
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
    TuiTextfield,
    PageHeaderComponent,
    PageTitleComponent,
    BreadcrumbsComponent,
    BreadcrumbsSkeletonComponent,
  ],
})
export class SettingsPreferencesPageComponent
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

  // Theme options
  protected readonly themeOptions: { label: string; value: ThemePreference }[] =
    [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
      { label: 'System', value: 'auto' },
    ];

  // Date format options
  protected readonly dateFormatOptions: {
    label: string;
    value: DateFormatPreference;
  }[] = [
    { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
    { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
    { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  ];

  // View mode options
  protected readonly viewModeOptions: {
    label: string;
    value: ViewModePreference;
  }[] = [
    { label: 'Grid', value: 'grid' },
    { label: 'List', value: 'list' },
  ];

  // Feed sort options
  protected readonly feedSortOptions: {
    label: string;
    value: FeedSortPreference;
  }[] = [
    { label: 'Most Recent', value: 'recent' },
    { label: 'Most Popular', value: 'popular' },
    { label: 'Recommended', value: 'recommended' },
  ];

  // Items per page options
  protected readonly itemsPerPageOptions = [10, 20, 50, 100];

  protected readonly displayPreferences = computed(
    () => this.preferences().display
  );
  protected readonly contentPreferences = computed(
    () => this.preferences().content
  );
  protected onThemeChange(theme: ThemePreference): void {
    this.editor.patch({ display: { theme } });
  }
  protected onDateFormatChange(dateFormat: DateFormatPreference): void {
    this.editor.patch({ display: { dateFormat } });
  }
  protected onViewModeChange(defaultView: ViewModePreference): void {
    this.editor.patch({ display: { defaultView } });
  }
  protected onFeedSortChange(feedSortOrder: FeedSortPreference): void {
    this.editor.patch({ content: { feedSortOrder } });
  }
  protected onItemsPerPageChange(itemsPerPage: number): void {
    this.editor.patch({ display: { itemsPerPage } });
  }
  protected onMatureContentToggle(showMatureContent: boolean): void {
    this.editor.patch({ content: { showMatureContent } });
  }
  protected onSave(): Promise<void> {
    return this.editor.save({
      display: this.displayPreferences(),
      content: this.contentPreferences(),
    });
  }
  protected onCancel(): void {
    this.editor.cancel();
  }
}
