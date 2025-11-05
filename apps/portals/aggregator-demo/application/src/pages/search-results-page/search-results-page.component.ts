import { Component, inject } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FILTERS } from '../../filters';
import { ActivatedRoute, Router } from '@angular/router';
import { FilterDirective, FilterGroupComponent, FilterVm, FilterOptionVm } from '@ui/filters';
import { MultiselectDropdownComponent, SearchableMultiselectComponent, TextSearchInputComponent } from '@ui/form';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { tap, map, of } from 'rxjs';
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
import { TuiAvatar, TuiChip, TuiFade } from '@taiga-ui/kit';


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

  public readonly filters$ = this._filtersContainer.params$
    .pipe(
      map(ps => this._paramMapToFilterVmListMapper.map(ps)),
      tap(console.log)
    )

  public readonly categoryOptions$ = inject(CATEGORY_OPTION_PROVIDER).getCategoryOptions().pipe(
    map(result => result.ok ? result.value.map(c => ({
      name: c.name,
      value: c.slug,
      isSelected: false
    } as FilterOptionVm)) : [])
  );
  public readonly platformOptions$ = inject(PLATFORM_OPTION_PROVIDER).getPlatformOptions().pipe(
    map(result => result.ok ? result.value.map(p => ({
      name: p.name,
      value: p.slug || String(p.id),
      isSelected: false
    } as FilterOptionVm)) : [])
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
   
 
}
