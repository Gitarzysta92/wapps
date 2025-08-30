import { ApplicationConfig } from "@angular/core";

import { CategoriesService } from "./application/categories.service";
import { CategoryApiService } from "./infrastructure/categories.restapi";
import { CATEGORIES_PROVIDER } from "./application/categories-provider.token";
import { CATEGORIES_PATH } from "./presentation/categories-path.token";
import { CategoryDtoToCategoryViewModelMapper } from "./presentation/mappings/category-dto-to-category-view-model.mapper";
import { CategoryDtoToFilterOptionVmMapper } from "./presentation/mappings/category-dto-to-filter-option-vm.mapper";

export function provideCategoryFeature(c: { path: string }): ApplicationConfig {
  return {
    providers: [
      { provide: CATEGORIES_PATH, useValue: c.path },
      { provide: CATEGORIES_PROVIDER, useClass: CategoryApiService },
      CategoryDtoToCategoryViewModelMapper,
      CategoryDtoToFilterOptionVmMapper,
      CategoriesService
    ]
  }
}