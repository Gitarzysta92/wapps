import { ApplicationConfig } from "@angular/core";
import { MONETIZATION_PROVIDER, MonetizationService } from "./application";
import { MonetizationApiService } from "./infrastructure/monetization-api.service";

export function provideListingMonetizationFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: MONETIZATION_PROVIDER, useClass: MonetizationApiService },
      MonetizationService
    ]
  }
}