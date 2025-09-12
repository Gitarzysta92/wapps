import { ApplicationConfig } from "@angular/core";
import { DeviceApiService } from "./infrastructure/device-api.service";
import { PLATFORMS_PROVIDER } from "./application/platforms-provider.token";
import { DeviceService } from "./application/device.service";

export function provideCompatibilityFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PLATFORMS_PROVIDER, useClass: DeviceApiService },
      DeviceService
    ]
  }
}