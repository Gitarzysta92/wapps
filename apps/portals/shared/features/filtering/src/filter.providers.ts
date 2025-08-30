import { ApplicationConfig } from "@angular/core";
import { ParamMapToFilterVmListMapper } from "./presentation/mappings/param-map-to-filter-vm-list.mapper";
import { FilterVmListToParamMapMapper } from "./presentation/mappings/filter-vm-list-to-param-map.mapper";
import { RouteDrivenFiltersContainerDirective } from "./presentation/route-driven-filters-container.directive";

export function provideFilterFeature(): ApplicationConfig {
  return {
    providers: [
      ParamMapToFilterVmListMapper,
      FilterVmListToParamMapMapper,
      RouteDrivenFiltersContainerDirective
    ]
  }
}