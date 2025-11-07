import { Component, inject, Injector } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FILTERS } from '../../filters';
import { ActivatedRoute, Router } from '@angular/router';
import { FilterVm, FilterOptionVm, SelectedFilterChipComponent, FiltersMultiselectComponent } from '@ui/filters';
import { map, tap } from 'rxjs/operators';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { MultiselectListComponent, SearchableOption, TextSearchInputComponent } from '@ui/form';
import { combineLatest, firstValueFrom, of } from 'rxjs';
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
import { TuiAppearance, TuiButton, TuiDialogService } from '@taiga-ui/core';
import { TuiDropdownOpen, TuiDropdownDirective } from '@taiga-ui/core/directives/dropdown';
import { FilterSelectionDialogComponent, FilterSelectionDialogResult } from '../../dialogs/filter-selection-dialog/filter-selection-dialog.component';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';

type FilterOptionSource = {
  name: string;
  slug: string;
};

type FilterDefinition = {
  key: string;
  name: string;
  options: FilterOptionSource[];
};

@Component({
  selector: 'search-results-page',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    TuiButton,
    SelectedFilterChipComponent,
    TuiDropdownOpen,
    TuiDropdownDirective,
    TuiAppearance,
    FiltersMultiselectComponent,
    MultiselectListComponent,
    TextSearchInputComponent,
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
  private readonly _injector = inject(Injector);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _filtersProvider = inject(RouteDrivenContainerDirective, { self: true });
  private readonly _paramMapToFilterVmListMapper = inject(ParamMapToFilterVmListMapper);
  private readonly _dialogService = inject(TuiDialogService);
  public readonly FILTERS = FILTERS;


  public readonly filters$ = this._filtersProvider.params$.pipe(
    map(ps => this._paramMapToFilterVmListMapper.map(ps)),
    map(fs => fs.filter(f => f.options.some(o => o.isSelected))),
    map(fs => fs.map(f => ({
      key: f.key,
      name: f.name,
      options: f.options.filter(o => o.isSelected),
    }))),
    tap(ps => console.log(ps)),
  ); 

  private readonly FILTERS_OPTIONS: FilterDefinition[] = [
    {
      key: this.FILTERS.category,
      name: 'Category',
      options: CATEGORY_OPTIONS as FilterOptionSource[],
    },
    
    {
      key: this.FILTERS.platform,
      name: 'Platform',
      options: PLATFORM_OPTIONS as FilterOptionSource[],
    },
    {
      key: this.FILTERS.device,
      name: 'Device',
      options: DEVICE_OPTIONS as FilterOptionSource[],
    },
    {
      key: this.FILTERS.monetization,
      name: 'Monetization',
      options: MONETIZATION_OPTIONS as FilterOptionSource[],
    },
    {
      key: this.FILTERS.social,
      name: 'Social',
      options: SOCIAL_OPTIONS as FilterOptionSource[],
    },
    {
      key: this.FILTERS.estimatedUsers,
      name: 'Estimated Users',
      options: ESTIMATED_USER_SPAN_OPTIONS as FilterOptionSource[],
    },
    {
      key: this.FILTERS.tag,
      name: 'Tag',
      options: TAG_OPTIONS as FilterOptionSource[],
    },
    {
      key: this.FILTERS.search,
      name: 'Search',
      options: [{ id: 0, name: 'Search', slug: 'search' } as FilterOptionSource],
    }
  ];

  readonly FILTERS_OPTIONS_DICTIONARY = {
    [this.FILTERS.category]: mapToSearchableOption(CATEGORY_OPTIONS),
    [this.FILTERS.platform]: mapToSearchableOption(PLATFORM_OPTIONS),
    [this.FILTERS.device]: mapToSearchableOption(DEVICE_OPTIONS),
    [this.FILTERS.monetization]: mapToSearchableOption(MONETIZATION_OPTIONS),
    [this.FILTERS.social]: mapToSearchableOption(SOCIAL_OPTIONS),
    [this.FILTERS.estimatedUsers]: mapToSearchableOption(ESTIMATED_USER_SPAN_OPTIONS),
    [this.FILTERS.tag]: mapToSearchableOption(TAG_OPTIONS),
    [this.FILTERS.search]: mapToSearchableOption([{ id: 0, name: 'Search', slug: 'search' }]),
  };

  public readonly allFiltersOptions$ = of(this.FILTERS_OPTIONS).pipe(
    map(fs => fs.map(f => ({
      id: f.key,
      name: f.name,
      isSelected: false,
    }))),
  );

  public readonly activeFiltersOptions$ = this.filters$.pipe(
    map(fs => fs.map(f => ({
      id: f.key,
      name: f.name,
      isSelected: true,
    }))),
  );
  
  public readonly availableFiltersOptions$ = combineLatest([this.allFiltersOptions$, this.activeFiltersOptions$])
    .pipe(
      map(([all, active]) => all.filter(f => !active.some(a => a.id === f.id))),
    )



  public setQueryParams(p: FilterVm[]): void {
    if ('phrase' in p && typeof p.phrase === 'string') {
      if (!p.phrase || p.phrase.length <= 0) {
        this._router.navigate([], { queryParams: {}})
      } else {
        this._router.navigate([], { queryParams: { pharse: p.phrase }})
      }
    }
  }
  
  public addFilterDropdownOpen = false;
  public openFilterDropdowns: { [filterId: string]: boolean } = {};

  public hasSelected(filter: FilterVm): boolean {
    return (filter.options ?? []).some(o => !!o.isSelected);
  }

  public isFilterDropdownOpen(filterId: string): boolean {
    return !!this.openFilterDropdowns[filterId];
  }

  public setFilterDropdownOpen(filterId: string, open: boolean): void {
    this.openFilterDropdowns[filterId] = open;
  }

  public async onActivateFilter(filterId: string): Promise<void> {
    const definition = this._findFilterDefinition(filterId);
    if (!definition) {
      console.warn(`Filter definition not found for id ${filterId}`);
      return;
    }

    this.addFilterDropdownOpen = false;

    const selectedValues = await firstValueFrom(
      this._filtersProvider.params$.pipe(
        map(params => Array.from(params[filterId] ?? []))
      )
    );

    const dialogData = {
      filterId,
      filterName: definition.name,
      options: this._mapFilterOptions(definition, selectedValues),
    };

    this._dialogService.open<FilterSelectionDialogResult | undefined>(
      new PolymorpheusComponent(FilterSelectionDialogComponent, this._injector),
      {
        size: 'l',
        data: dialogData,
      }
    ).subscribe(result => {
      if (!result) {
        return;
      }
      this._applyFilterSelection(result);
    });
  }

  public onOpenFilterDropdown(filterId: string): void {
    this.setFilterDropdownOpen(filterId, true);
  }

  public onCloseFilterDropdown(filterId: string): void {
    this.setFilterDropdownOpen(filterId, false);
  }


  public onFilterSelectionChange(filterId: string, selected: SearchableOption[]): void {
    const values = selected.map(o => o.value);
    const queryParams = values.length > 0
      ? { [filterId]: values }
      : { [filterId]: null };

    this._router.navigate([], {
      relativeTo: this._route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  public onDeactivateFilter(filterId: string): void {
    this._clearFilterSelection(filterId);
  }
   
 
  public getFilterDefinition(filterId: string): FilterDefinition | undefined {
    return this._findFilterDefinition(filterId);
  }

  private _findFilterDefinition(filterId: string): FilterDefinition | undefined {
    return this.FILTERS_OPTIONS.find(f => f.key === filterId);
  }

  private _mapFilterOptions(definition: FilterDefinition, selectedValues: string[]): FilterOptionVm[] {
    const selected = new Set(selectedValues);
    return definition.options.map(option => ({
      name: option.name,
      value: option.slug,
      isSelected: selected.has(option.slug),
    }));
  }

  private _applyFilterSelection(result: FilterSelectionDialogResult): void {
    const values = result.selected.map(o => o.value);
    const queryParams = values.length > 0
      ? { [result.filterId]: values }
      : { [result.filterId]: null };

    this._router.navigate([], {
      relativeTo: this._route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private _clearFilterSelection(filterId: string): void {
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: { [filterId]: null },
      queryParamsHandling: 'merge',
    });
  }
}

function mapToSearchableOption(options: { id: number; name: string; slug: string }[]): SearchableOption[] {
  return options.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isSelected: false,
    value: c.slug,
  }));
}
