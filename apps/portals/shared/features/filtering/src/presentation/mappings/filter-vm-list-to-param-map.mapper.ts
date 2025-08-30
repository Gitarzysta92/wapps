import { Injectable } from "@angular/core";
import { FilterVm } from "../models/filter.vm";


@Injectable()
export class FilterVmListToParamMapMapper {
  public map(fvms: FilterVm[]): { [key: string]: Set<string> } {
    return Object.fromEntries(fvms.map((fvm) => [
      fvm.key,
      new Set(fvm.options.map(o => o.value))
    ]))
  }
}