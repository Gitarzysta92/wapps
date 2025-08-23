import { Component, inject } from '@angular/core';
import { ChipCheckboxComponent } from '../../../libs/ui/components/form/chip-checkbox/chip-checkbox.component';
import { AsyncPipe } from '@angular/common';
import { CategoryListContainerDirective } from '../../../libs/features/listing/category/feature/presentation/category-list-container.directive';
import { PlatformListContainerDirective } from '../../../libs/features/listing/platform/presentation';
import { FILTERS } from '../../../filters';
import { FilterDirective, FilterGroupComponent, FilterVm } from '../../../libs/ui/components/filters';
import { ToFilterOptionsList } from '../../../libs/ui/components/filters/to-filter-options-list.pipe';
import { map } from 'rxjs';
import { DeviceListContainerDirective } from '../../../libs/features/listing/device/presentation';
import { MonetizationListContainerDirective } from '../../../libs/features/listing/monetization/presentation';
import { SocialListContainerDirective } from '../../../libs/features/listing/social/presentation';
import { EstimatedUserSpanListContainerDirective } from '../../../libs/features/listing/statistic/users/presentation';
import { TagListContainerDirective } from '../../../libs/features/listing/tags/feature/presentation';
import { RouteDrivenContainerDirective } from '../../../libs/ui/routing/route-driven-container.directive';
import { FilterVmListToParamMapMapper } from '../../../libs/features/listing/filter/presentation/mappings/filter-vm-list-to-param-map.mapper';
import { ParamMapToFilterVmListMapper } from '../../../libs/features/listing/filter/presentation/mappings/param-map-to-filter-vm-list.mapper';

@Component({
  selector: 'filters-panel',
  templateUrl: './filters-panel.component.html',
  styleUrl: './filters-panel.component.scss',
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
    PlatformListContainerDirective,
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
