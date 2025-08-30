import { ApplicationConfig } from "@angular/core";
import { PLATFORMS_PROVIDER } from "@domains/catalog/platform";
import { PlatformService } from "./platform.service";
import { PlatformApiService } from "./platform-api.service";

export function provideListingPlatformFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PLATFORMS_PROVIDER, useClass: PlatformApiService },
      PlatformService
    ]
  }
}