import { ApplicationConfig } from "@angular/core";
import { APP_LISTING_PROVIDER, AppListingService, CategoriesService } from "./application";
import { AppListingApiService } from "./infrastructure";

export function provideListingFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: APP_LISTING_PROVIDER, useClass: AppListingApiService },
      AppListingService,
      CategoriesService
    ]
  }
}
