import { AsyncPipe } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { CategoryListContainerDirective } from '../../../libs/features/listing/category/feature/presentation/category-list-container.directive';
import { PlatformListContainerDirective } from '../../../libs/features/listing/platform/presentation';
import { FilterDirective, FilterGroupComponent, FilterVm } from '../../../libs/ui/components/filters';
import { MultiselectDropdownComponent } from '../../../libs/ui/components/form/multiselect-dropdown/multiselect-dropdown.component';
import { FILTERS } from '../../../filters';
import { ToFilterOptionsList } from '../../../libs/ui/components/filters/to-filter-options-list.pipe';
import { CategoryMultiselectComponent } from '../category-multiselect/category-multiselect.component';
import { map } from 'rxjs';
import { RouteDrivenContainerDirective } from '../../../libs/ui/routing/route-driven-container.directive';
import { ParamMapToFilterVmListMapper } from '../../../libs/features/listing/filter/presentation/mappings/param-map-to-filter-vm-list.mapper';
import { FilterVmListToParamMapMapper } from '../../../libs/features/listing/filter/presentation/mappings/filter-vm-list-to-param-map.mapper';

@Component({
  selector: 'filters-bar',
  templateUrl: './filters-bar.component.html',
  styleUrl: './filters-bar.component.scss',
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  imports: [
    FilterDirective,
    FilterGroupComponent,
    MultiselectDropdownComponent,
    AsyncPipe,
    PlatformListContainerDirective,
    CategoryListContainerDirective,
    ToFilterOptionsList,
    CategoryMultiselectComponent
  ]
})
export class FiltersBarComponent {

  @Output() onUpdate: EventEmitter<{ [key: string]: string[] }> = new EventEmitter()

  public readonly filterKey = FILTERS;
  private readonly _filtersContainer = inject(RouteDrivenContainerDirective, { self: true });
  private readonly _fromParamMapMapper = inject(ParamMapToFilterVmListMapper);
  private readonly _toParamMapMapper = inject(FilterVmListToParamMapMapper);

  public readonly filters$ = this._filtersContainer.params$
    .pipe(map(ps => this._fromParamMapMapper.map(ps).filter(f => f.options.length > 0)))
  
  public emitFilterChange(fvms: FilterVm[]): void {
    for (let fv of fvms) {
      fv.options = fv.options.filter(o => o.isSelected);
    }
    this.onUpdate.next(this._mapParamsToFilterParams(this._toParamMapMapper.map(fvms)))
  }

  private _mapParamsToFilterParams(
    c: { [key: string]: Set<string>; }
  ): { [key: string]: string[]; } {
  return Object.fromEntries(
    Object.entries(c).map(([key, set]) => [key, Array.from(set)])
  );
}
}
