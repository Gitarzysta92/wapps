import { Component, inject } from '@angular/core';
import { ChipCheckboxComponent } from '@ui/form';
import { AsyncPipe } from '@angular/common';
import { CategoryListContainerDirective } from '@portals/shared/features/categories';
import { PlatformListContainerDirective } from '@portals/shared/features/platform';
import { FILTERS } from '../../../filters';
import { FilterDirective, FilterGroupComponent, FilterVm, ToFilterOptionsList } from '@ui/filters';
import { map } from 'rxjs';
import { DeviceListContainerDirective } from '@portals/shared/features/device';
import { MonetizationListContainerDirective } from '@portals/shared/features/monetization';
import { SocialListContainerDirective } from '@portals/shared/features/social';
import { EstimatedUserSpanListContainerDirective } from '@portals/shared/features/metrics';
import { TagListContainerDirective } from '@portals/shared/features/tags';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { FilterVmListToParamMapMapper, ParamMapToFilterVmListMapper } from '@portals/shared/features/filtering';

@Component({
  selector: 'filters-panel',
  templateUrl: './filters-panel.component.html',
  styleUrl: './filters-panel.component.scss',
  standalone: true,
  hostDirectives: [
    {
      directive: RouteDrivenContainerDirective,
      outputs: ['onUpdate']
    }
  ],
  imports: [
    FilterDirective,
    FilterGroupComponent,
    ChipCheckboxComponent,
    AsyncPipe,
    PlatformListContainerDirective,
    CategoryListContainerDirective,
    DeviceListContainerDirective,
    MonetizationListContainerDirective,
    SocialListContainerDirective,
    EstimatedUserSpanListContainerDirective,
    TagListContainerDirective,
    ToFilterOptionsList
  ],
})
export class FiltersPanelComponent {
  public readonly filterKey = FILTERS;
  private readonly _filtersContainer = inject(RouteDrivenContainerDirective, { self: true });
  private readonly _fromParamMapMapper = inject(ParamMapToFilterVmListMapper);
  private readonly _toParamMapMapper = inject(FilterVmListToParamMapMapper);

  public readonly filters$ = this._filtersContainer.params$
    .pipe(map(ps => {
      const fs = this._fromParamMapMapper.map(ps);
      const filters = this._getFilters();
      for (let filter of filters) {
        filter.options = fs.find(f => f.key === filter.key)?.options ?? [];
      }
      return filters;
    }))
  
  public emitFilterChange(fvms: FilterVm[]): void {
    for (let fv of fvms) {
      fv.options = fv.options.filter(o => o.isSelected);
    }
    this._filtersContainer.update(this._toParamMapMapper.map(fvms))
  }
  
  private _getFilters(): FilterVm[] {
    return [
      {
        key: this.filterKey.category,
        options: [],
        name: this.filterKey.category
      },
      {
        key: this.filterKey.platform,
        options: [],
        name: this.filterKey.platform
      },
      {
        key: this.filterKey.device,
        options: [],
        name: this.filterKey.device
      },
      {
        key: this.filterKey.monetization,
        options: [],
        name: this.filterKey.monetization
      },
      {
        key: this.filterKey.social,
        options: [],
        name: this.filterKey.social
      },
      {
        key: this.filterKey.estimatedUsers,
        options: [],
        name: this.filterKey.estimatedUsers
      },
      {
        key: this.filterKey.tag,
        options: [],
        name: this.filterKey.tag
      },
    ]
  }
}
