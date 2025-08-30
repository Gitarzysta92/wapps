import { Directive, inject } from "@angular/core";
import { ParamMapToFilterVmListMapper } from "./mappings/param-map-to-filter-vm-list.mapper";
import { FilterVmListToParamMapMapper } from "./mappings/filter-vm-list-to-param-map.mapper";

@Directive({
  selector: '[routeDrivenFiltersContainer]',
  exportAs: 'routeDrivenFiltersContainer'
})
export class RouteDrivenFiltersContainerDirective {
  private readonly _paramMapToFilterVmListMapper = inject(ParamMapToFilterVmListMapper);
  private readonly _filterVmListToParamMapMapper = inject(FilterVmListToParamMapMapper);

  public mapParamMapToFilterVmList(paramMap: { [key: string]: Set<string> }) {
    return this._paramMapToFilterVmListMapper.map(paramMap);
  }

  public mapFilterVmListToParamMap(filterVmList: any[]) {
    return this._filterVmListToParamMapMapper.map(filterVmList);
  }
}
