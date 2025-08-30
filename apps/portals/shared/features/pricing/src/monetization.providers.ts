import { ApplicationConfig } from "@angular/core";
import { MONETIZATION_PROVIDER, MonetizationService } from "../../../../../libs/features/listing/monetization/application";
import { MonetizationApiService } from "./monetization-api.service";

export function provideListingMonetizationFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: MONETIZATION_PROVIDER, useClass: MonetizationApiService },
      MonetizationService
    ]
  }
}