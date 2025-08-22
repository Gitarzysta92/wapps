import { TemplateRef } from "@angular/core";
import { FilterVm } from "./filter.vm";

export type FilterWithSelectorRefVm = FilterVm & {
  componentRef: TemplateRef<any>;
} 