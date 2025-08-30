import { ApplicationConfig } from "@angular/core";
import { MONETIZATION_PROVIDER, MonetizationService } from "./application";
import { MonetizationApiService } from "./infrastructure";

export function provideListingMonetizationFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: MONETIZATION_PROVIDER, useClass: MonetizationApiService },
      MonetizationService
    ]
  }
}