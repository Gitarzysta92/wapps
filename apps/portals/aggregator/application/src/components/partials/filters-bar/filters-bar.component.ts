import { AsyncPipe } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';

import { PlatformListContainerDirective } from '@portals/shared/features/platform';
import { FilterDirective, FilterGroupComponent, FilterVm, ToFilterOptionsList } from '@ui/filters';
import { MultiselectDropdownComponent } from '@ui/form';
import { FILTERS } from '../../../filters';
import { CategoryMultiselectComponent } from '../category-multiselect/category-multiselect.component';
import { map } from 'rxjs';
import { RouteDrivenContainerDirective } from '@ui/routing';
import { ParamMapToFilterVmListMapper, FilterVmListToParamMapMapper } from '@portals/shared/features/filtering';

@Component({
  selector: 'filters-bar',
  templateUrl: './filters-bar.component.html',
  styleUrl: './filters-bar.component.scss',
  standalone: true,
  hostDirectives: [
    RouteDrivenContainerDirective
  ],
  imports: [
    FilterDirective,
    FilterGroupComponent,
    MultiselectDropdownComponent,
    AsyncPipe,
    PlatformListContainerDirective,
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
