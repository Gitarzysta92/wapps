import { Injectable } from "@angular/core";
import { FilterVm } from "../models/filter.vm";
import { FilterOptionVm } from "../models/filter.vm";

@Injectable()
export class ParamMapToFilterVmListMapper {
  public map(p: { [key: string]: Set<string> }): FilterVm[]  {
    const vms: FilterVm[] = [];
    for (let key in p) {
      const f = { key, name: key, options: [] as FilterOptionVm[] };
      for (let o of p[key]) {
        f.options.push({
          name: o,
          value: o,
          isSelected: true
        })
      }
      vms.push(f);
    }
    return vms;
  }
}