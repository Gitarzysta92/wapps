import { ApplicationConfig } from "@angular/core";
import { PLATFORMS_PROVIDER, PlatformService } from "./application";
import { PlatformApiService } from "./infrastructure/platform-api.service";

export function provideListingPlatformFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PLATFORMS_PROVIDER, useClass: PlatformApiService },
      PlatformService
    ]
  }
}