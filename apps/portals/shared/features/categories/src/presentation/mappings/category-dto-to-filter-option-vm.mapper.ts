import { Injectable } from "@angular/core";
import { CategoryDto } from "../../application/models";
import { FilterOptionVm } from "../../../../../../ui/components/filters";
import { generateSlug } from "../../../../filter/presentation/helpers/slug-generator";

@Injectable()
export class CategoryDtoToFilterOptionVmMapper {


  map(c: CategoryDto): FilterOptionVm {
    return {
      name: c.name,
      value: generateSlug(c.name),
      isSelected: false
    }
  }
}