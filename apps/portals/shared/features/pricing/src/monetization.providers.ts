import { ApplicationConfig } from "@angular/core";
import { MONETIZATION_PROVIDER } from "./application/monetization-provider.port";
import { MonetizationService } from "./application/monetization.service";
import { MonetizationApiService } from "./infrastructure/monetization-api.service";


export function provideListingMonetizationFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: MONETIZATION_PROVIDER, useClass: MonetizationApiService },
      MonetizationService
    ]
  }
}