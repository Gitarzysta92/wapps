import { ApplicationConfig } from "@angular/core";
import { APP_LISTING_PROVIDER, AppListingService, CategoriesService } from "./application";
import { AppListingApiService, AppListingBffApiService } from "./infrastructure";

export function provideListingFeature(config?: { useBff?: boolean }): ApplicationConfig {
  const useRealApi = config?.useBff ?? true;
  
  return {
    providers: [
      { 
        provide: APP_LISTING_PROVIDER, 
        useClass: useRealApi ? AppListingBffApiService : AppListingApiService 
      },
      AppListingService,
      CategoriesService
    ]
  };
}
