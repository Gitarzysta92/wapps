import { inject, Injectable } from "@angular/core";
import { CategoryDto } from "@domains/catalog/category";
import { CategoryVm } from "../models/category.vm";
import { CATEGORIES_PATH } from "../categories-path.token";

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