import { Injectable } from "@angular/core";
import { CategoryDto } from "@domains/catalog/category";
import { FilterOptionVm } from "@ui/filters";

@Injectable()
export class CategoryDtoToFilterOptionVmMapper {

  map(c: CategoryDto): FilterOptionVm {
    return {
      name: c.name,
      value: c.slug,
      isSelected: false
    }
  }
}