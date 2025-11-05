import { Component, inject } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FILTERS } from '../../filters';
import { ActivatedRoute, Router } from '@angular/router';
import { FilterDirective, FilterGroupComponent, FilterVm, FilterOptionVm, SelectedFilterChipComponent, FiltersMultiselectComponent, FiltersMultiselectVM } from '@ui/filters';
import { map } from 'rxjs/operators';
import { MultiselectDropdownComponent, SearchableMultiselectComponent, TextSearchInputComponent } from '@ui/form';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { of } from 'rxjs';
import { 
  CATEGORY_OPTION_PROVIDER,
  PLATFORM_OPTION_PROVIDER,
  DEVICE_OPTION_PROVIDER,
  MONETIZATION_OPTION_PROVIDER,
  SOCIAL_OPTION_PROVIDER,
  ESTIMATED_USER_SPAN_OPTION_PROVIDER,
  TAG_OPTION_PROVIDER,
  ParamMapToFilterVmListMapper
} from '@portals/shared/features/filtering';
import {
  CATEGORY_OPTIONS,
  PLATFORM_OPTIONS,
  DEVICE_OPTIONS,
  MONETIZATION_OPTIONS,
  SOCIAL_OPTIONS,
  ESTIMATED_USER_SPAN_OPTIONS,
  TAG_OPTIONS
} from '@portals/shared/data';
import { TuiChip, TuiFade, TuiCheckbox } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core';
import { TuiDropdownOpen, TuiDropdownDirective } from '@taiga-ui/core/directives/dropdown';


@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    FilterDirective,
    FilterGroupComponent,
    MultiselectDropdownComponent,
    SearchableMultiselectComponent,
    TextSearchInputComponent,
    AsyncPipe,
    TuiChip,
    TuiFade,
    TuiIcon,
    SelectedFilterChipComponent,
    TuiDropdownOpen,
    TuiDropdownDirective,
    TuiCheckbox,
    FiltersMultiselectComponent,
    // PlatformListContainerDirective,
    // ToFilterOptionsList,
  ],
  templateUrl: './search-results-page.component.html',
  styleUrl: './search-results-page.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  host: {
    'class': 'fluid-container'
  },
  providers: [
    {
      provide: CATEGORY_OPTION_PROVIDER,
      useValue: {
        getCategoryOptions: () => of({ ok: true as const, value: CATEGORY_OPTIONS })
      }
    },
    {
      provide: PLATFORM_OPTION_PROVIDER,
      useValue: {
        getPlatformOptions: () => of({ ok: true as const, value: PLATFORM_OPTIONS })
      }
    },
    {
      provide: DEVICE_OPTION_PROVIDER,
      useValue: {
        getDeviceOptions: () => of({ ok: true as const, value: DEVICE_OPTIONS })
      }
    },
    {
      provide: MONETIZATION_OPTION_PROVIDER,
      useValue: {
        getMonetizationOptions: () => of({ ok: true as const, value: MONETIZATION_OPTIONS })
      }
    },
    {
      provide: SOCIAL_OPTION_PROVIDER,
      useValue: {
        getSocialOptions: () => of({ ok: true as const, value: SOCIAL_OPTIONS })
      }
    },
    {
      provide: ESTIMATED_USER_SPAN_OPTION_PROVIDER,
      useValue: {
        getEstimatedUserSpanOptions: () => of({ ok: true as const, value: ESTIMATED_USER_SPAN_OPTIONS })
      }
    },
    {
      provide: TAG_OPTION_PROVIDER,
      useValue: {
        getTagOptions: () => of({ ok: true as const, value: TAG_OPTIONS })
      }
    },
  ]
})
export class SearchResultsPageComponent {
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _filtersContainer = inject(RouteDrivenContainerDirective, { self: true });
  private readonly _paramMapToFilterVmListMapper = inject(ParamMapToFilterVmListMapper);
  public readonly FILTERS = FILTERS;

  // DEV: simple static filters for development
  public readonly filters$ = of<FilterVm[]>([
    {
      key: this.FILTERS.category,
      name: 'Category',
      options: [
        { name: 'Games', value: 'games', isSelected: false },
        { name: 'Social', value: 'social', isSelected: false },
        { name: 'Productivity', value: 'productivity', isSelected: false },
      ],
    },
    {
      key: this.FILTERS.platform,
      name: 'Platform',
      options: [
        { name: 'iOS', value: 'ios', isSelected: false },
        { name: 'Android', value: 'android', isSelected: false },
        { name: 'Web', value: 'web', isSelected: false },
      ],
    },
    {
      key: this.FILTERS.search,
      name: 'Search',
      options: [
        { name: 'example', value: 'example', isSelected: false },
      ],
    },
  ]);

  // DEV: static options for development
  public readonly categoryOptions$ = of<FilterOptionVm[]>([
    { name: 'Games', value: 'games', isSelected: false },
    { name: 'Social', value: 'social', isSelected: false },
    { name: 'Productivity', value: 'productivity', isSelected: false },
  ]);
  public readonly platformOptions$ = of<FilterOptionVm[]>([
    { name: 'iOS', value: 'ios', isSelected: false },
    { name: 'Android', value: 'android', isSelected: false },
    { name: 'Web', value: 'web', isSelected: false },
  ]);

  public readonly filtersMultiselectVm$ = this.filters$
    .pipe(
      map((fs) => ({
        selectedFilters: (fs ?? []).map(f => ({
          id: f.key,
          name: f.name,
          isSelected: (f.options ?? []).some(o => o.isSelected)
        }))
      } as FiltersMultiselectVM))
    );
  public readonly deviceOptions$ = inject(DEVICE_OPTION_PROVIDER).getDeviceOptions();
  public readonly monetizationOptions$ = inject(MONETIZATION_OPTION_PROVIDER).getMonetizationOptions();
  public readonly socialOptions$ = inject(SOCIAL_OPTION_PROVIDER).getSocialOptions();
  public readonly estimatedUserSpanOptions$ = inject(ESTIMATED_USER_SPAN_OPTION_PROVIDER).getEstimatedUserSpanOptions();
  public readonly tagOptions$ = inject(TAG_OPTION_PROVIDER).getTagOptions();

  public setQueryParams(p: FilterVm[]): void {
    if ('phrase' in p && typeof p.phrase === 'string') {
      if (!p.phrase || p.phrase.length <= 0) {
        this._router.navigate([], { queryParams: {}})
      } else {
        this._router.navigate([], { queryParams: { pharse: p.phrase }})
      }
    }
  }
  
  public categoryDropdownOpen = false;
  public onOpenCategory(): void { this.categoryDropdownOpen = true; }
  public onCloseCategory(): void { this.categoryDropdownOpen = false; }

  public platformDropdownOpen = false;
  public onOpenPlatform(): void { this.platformDropdownOpen = true; }
  public onClosePlatform(): void { this.platformDropdownOpen = false; }

  public searchDropdownOpen = false;
  public onOpenSearch(): void { this.searchDropdownOpen = true; }
  public onCloseSearch(): void { this.searchDropdownOpen = false; }

  public addFilterDropdownOpen = false;

  public hasSelected(filter: FilterVm): boolean {
    return (filter.options ?? []).some(o => !!o.isSelected);
  }

  public onActivateFilter(filterId: string): void {
    console.debug('activate filter', filterId);
  }

  public onDeactivateFilter(filterId: string): void {
    console.debug('deactivate filter', filterId);
  }
   
 
}
