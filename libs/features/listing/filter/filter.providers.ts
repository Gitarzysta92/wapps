import { ApplicationConfig } from "@angular/core";
import { ParamMapToFilterVmListMapper } from "./presentation/mappings/param-map-to-filter-vm-list.mapper";
import { FilterVmListToParamMapMapper } from "./presentation/mappings/filter-vm-list-to-param-map.mapper";

export function provideFilterFeature(): ApplicationConfig {
  return {
    providers: [
      ParamMapToFilterVmListMapper,
      FilterVmListToParamMapMapper
    ]
  }
}