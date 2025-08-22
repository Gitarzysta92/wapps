import { FilterVm } from "../models/filter.vm";

export interface IFilterGroup {
  emitChanges(filter: FilterVm ): void
}