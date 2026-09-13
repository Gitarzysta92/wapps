import { Component, computed, inject, Injector, input, output } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectedFilterChipComponent } from '@ui/filters';
import { map } from 'rxjs/operators';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { SearchableOption } from '@ui/form';
import { combineLatest, firstValueFrom, of } from 'rxjs';
import {
  CATEGORY_OPTIONS, PLATFORM_OPTIONS, DEVICE_OPTIONS, MONETIZATION_OPTIONS,
  SOCIAL_OPTIONS, ESTIMATED_USER_SPAN_OPTIONS, TAG_OPTIONS,
} from '@portals/shared/data';
import { TuiDialogService } from '@taiga-ui/core';
import { TuiDropdownOpen, TuiDropdownDirective } from '@taiga-ui/core/directives/dropdown';
import { FilterSelectionDialogComponent, FilterSelectionDialogResult } from './filter-selection-dialog.component';
import { FilterContentComponent } from './filter-content.component';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';

export interface FilterDefinition {
  key: string;
  name: string;
  options: { id?: string | number; name: string; slug: string }[];
  singleSelection?: boolean;
}

const DEFAULT_FILTERS: FilterDefinition[] = [
  { key: 'category', name: 'Category', options: CATEGORY_OPTIONS },
  { key: 'platform', name: 'Platform', options: PLATFORM_OPTIONS },
  { key: 'device', name: 'Device', options: DEVICE_OPTIONS },
  { key: 'monetization', name: 'Monetization', options: MONETIZATION_OPTIONS },
  { key: 'social', name: 'Social', options: SOCIAL_OPTIONS },
  { key: 'estimated-users', name: 'Estimated Users', options: ESTIMATED_USER_SPAN_OPTIONS },
  { key: 'tag', name: 'Tag', options: TAG_OPTIONS },
  { key: 'search', name: 'Search', options: [] },
];

@Component({
  selector: 'filters-bar',
  standalone: true,
  imports: [CommonModule, AsyncPipe, SelectedFilterChipComponent,
    TuiDropdownOpen, TuiDropdownDirective, FilterContentComponent],
  templateUrl: './filters-bar.component.html',
  styleUrl: './filters-bar.component.scss',
})
export class FiltersBarComponent {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly routeFilters = inject(RouteDrivenContainerDirective, { optional: true });
  private readonly dialogs = inject(TuiDialogService);

  readonly definitions = input<FilterDefinition[]>(DEFAULT_FILTERS);
  // Catalog pages supply effective selections, including path constraints, and own navigation.
  // Discover continues to use the route directly.
  readonly selectedValues = input<Record<string, string[]> | undefined>();
  readonly selectionChange = output<FilterSelectionDialogResult>();

  readonly optionsDictionary = computed<Record<string, SearchableOption[]>>(() =>
    Object.fromEntries(this.definitions().map(definition => [definition.key,
      definition.options.map((option, id) => ({ id, name: option.name, value: option.slug, isSelected: false })),
    ])));

  private readonly state$ = combineLatest([
    this.routeFilters?.params$ ?? of({} as Record<string, Set<string>>),
    toObservable(computed(() => ({ definitions: this.definitions(), values: this.selectedValues() }))),
  ]).pipe(map(([params, config]) => ({
    definitions: config.definitions,
    values: config.values ?? Object.fromEntries(Object.entries({
      ...params,
      ...(!params['search'] && params['q'] ? { search: params['q'] } : {}),
      ...(params['tags'] ? { tag: new Set([...(params['tag'] ?? []), ...params['tags']]) } : {}),
    }).map(([key, values]) => [key, [...values]])),
  })));

  readonly filters$ = this.state$.pipe(map(({ definitions, values }) => definitions.map(definition => ({
    key: definition.key,
    name: definition.name,
    options: [...new Set((values[definition.key] ?? []).flatMap(value =>
      definition.key === 'search' ? [value] : value.split(',')).filter(Boolean))].map((value, id) => ({
        id, value, isSelected: true,
        name: definition.options.find(option => option.slug === value)?.name ?? value,
      })),
  })).filter(filter => filter.options.length > 0)));

  readonly allFiltersOptions$ = toObservable(this.definitions).pipe(map(definitions =>
    definitions.map(filter => ({ id: filter.key, name: filter.name, isSelected: false }))));
  readonly activeFiltersOptions$ = this.filters$.pipe(map(filters =>
    filters.map(filter => ({ id: filter.key, name: filter.name, isSelected: true }))));
  readonly availableFiltersOptions$ = combineLatest([this.allFiltersOptions$, this.activeFiltersOptions$]).pipe(
    map(([all, active]) => all.filter(filter => !active.some(item => item.id === filter.id))));

  addFilterDropdownOpen = false;
  openFilterDropdowns: Partial<Record<string, boolean>> = {};

  getPlaceholder(filterId: string): string {
    const labels: Record<string, string> = {
      category: 'categories', tag: 'tags', platform: 'platforms', device: 'devices',
      monetization: 'monetization', social: 'social', 'estimated-users': 'user ranges',
    };
    return filterId === 'search' ? 'Search...' : `Search ${labels[filterId] ?? 'options'}...`;
  }

  isSingleSelection(filterId: string): boolean {
    return this.definitions().find(filter => filter.key === filterId)?.singleSelection ?? false;
  }

  getSelectedOptionsWithFlag(filterId: string, selected: SearchableOption[]): (SearchableOption & { isSelected: boolean })[] {
    return selected.map(option => ({ ...option, isSelected: true }));
  }

  async onActivateFilter(filterId: string): Promise<void> {
    const definition = this.definitions().find(filter => filter.key === filterId);
    if (!definition) return;
    this.addFilterDropdownOpen = false;
    const filters = await firstValueFrom(this.filters$);
    const selected = filters.find(filter => filter.key === filterId)?.options ?? [];
    const items = filterId === 'search' ? selected : (this.optionsDictionary()[filterId] ?? []).map(item => ({
      ...item, isSelected: selected.some(option => option.value === item.value),
    }));
    this.dialogs.open<FilterSelectionDialogResult | undefined>(
      new PolymorpheusComponent(FilterSelectionDialogComponent, this.injector),
      { size: 'l', data: {
        filterId, filterName: definition.name, options: selected, items,
        placeholder: this.getPlaceholder(filterId), singleSelection: definition.singleSelection,
      } },
    ).subscribe(result => {
      if (result) this.onFilterSelectionChange(result.filterId, result.selected);
    });
  }

  onOpenFilterDropdown(filterId: string): void { this.openFilterDropdowns[filterId] = true; }
  onCloseFilterDropdown(filterId: string): void { this.openFilterDropdowns[filterId] = false; }

  onFilterSelectionChange(filterId: string, selected: SearchableOption[]): void {
    if (this.selectedValues() !== undefined) {
      this.selectionChange.emit({ filterId, selected });
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [filterId]: selected.length ? selected.map(option => option.value) : null,
        page: null,
        ...(filterId === 'search' ? { q: null } : {}),
        ...(filterId === 'tag' ? { tags: null } : {}),
      },
      queryParamsHandling: 'merge',
    });
  }

  onDeactivateFilter(filterId: string): void {
    this.onCloseFilterDropdown(filterId);
    this.onFilterSelectionChange(filterId, []);
  }
}
