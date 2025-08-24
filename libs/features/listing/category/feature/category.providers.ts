import { ApplicationConfig } from "@angular/core";
import { CATEGORIES_PATH, CategoryDtoToCategoryViewModelMapper } from "./presentation";
import { CategoriesService } from "./application";
import { CATEGORIES_PROVIDER } from "./application/ports";
import { CategoryApiService } from "./infrastructure/category-api.service";
import { CategoryDtoToFilterOptionVmMapper } from "./presentation/mappings/category-dto-to-filter-option-vm.mapper";

export function provideListingCategoryFeature(c: { path: string }): ApplicationConfig {
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