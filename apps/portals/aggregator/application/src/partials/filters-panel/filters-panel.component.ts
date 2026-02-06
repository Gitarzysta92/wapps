import { Component } from '@angular/core';
import { ChipCheckboxComponent } from '@ui/form';
import { AsyncPipe } from '@angular/common';
import { CategoryListContainerDirective } from '@portals/shared/features/categories';
import { PlatformListContainerDirective } from '@portals/shared/features/platform';
import { FILTERS } from '../../filters';
import { FilterDirective, FilterGroupComponent, FilterVm, ToFilterOptionsList } from '@ui/filters';
import { of } from 'rxjs';

import { SocialListContainerDirective } from '@portals/shared/features/social';
import { EstimatedUserSpanListContainerDirective } from '@portals/shared/features/metrics';
import { TagListContainerDirective } from '@portals/shared/features/tags';
import { DeviceListContainerDirective } from '@portals/shared/features/compatibility';
import { MonetizationListContainerDirective } from '@portals/shared/features/pricing';


@Component({
  selector: 'filters-panel',
  templateUrl: './filters-panel.component.html',
  styleUrl: './filters-panel.component.scss',
  standalone: true,
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

  // WIP: route-driven filter syncing is outdated in this app; keep local defaults for now.
  public readonly filters$ = of(this._getFilters());
  
  public emitFilterChange(fvms: FilterVm[]): void {
    // no-op for now (build-only stabilization)
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
