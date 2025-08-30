import { ApplicationConfig } from "@angular/core";
import { CATEGORIES_PATH, CategoryDtoToCategoryViewModelMapper } from "../../../../../libs/features/listing/category/feature/presentation";
import { CategoriesService } from "../../../../../libs/features/listing/category/feature/application";
import { CATEGORIES_PROVIDER } from "../../../../../libs/features/listing/category/feature/application/ports";
import { CategoryApiService } from "../../../../../libs/features/listing/category/feature/infrastructure/category-api.service";
import { CategoryDtoToFilterOptionVmMapper } from "../../../../../libs/features/listing/category/feature/presentation/mappings/category-dto-to-filter-option-vm.mapper";

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