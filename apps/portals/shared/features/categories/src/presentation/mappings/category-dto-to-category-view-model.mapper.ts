import { inject, Injectable } from "@angular/core";
import { CategoryDto } from "../../application/models";
import { CategoryVm } from "../models/category.vm";
import { CATEGORIES_PATH } from "../ports/categories-path.port";

@Injectable()
export class CategoryDtoToCategoryViewModelMapper {
  private readonly _categoryPath = inject(CATEGORIES_PATH);
  map(c: CategoryDto): CategoryVm {
    return {
      ...c,
      path: `${this._categoryPath}/${c.slug}/page/1`
    }
  }
}