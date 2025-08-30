import { ApplicationConfig } from "@angular/core";
import { PLATFORMS_PROVIDER } from "@domains/catalog/platform";
import { PlatformService } from "./application/platform.service";
import { PlatformApiService } from "./infrastructure/platform-api.service";

export function provideListingPlatformFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PLATFORMS_PROVIDER, useClass: PlatformApiService },
      PlatformService
    ]
  }
}