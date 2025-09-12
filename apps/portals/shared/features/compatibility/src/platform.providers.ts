import { ApplicationConfig } from "@angular/core";
import { PlatformService } from "./application/platform.service";
import { PlatformApiService } from "./application/platform-api.service";
import { PLATFORMS_PROVIDER } from "./application/platforms-provider.token";

export function provideListingPlatformFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PLATFORMS_PROVIDER, useClass: PlatformApiService },
      PlatformService
    ]
  }
}