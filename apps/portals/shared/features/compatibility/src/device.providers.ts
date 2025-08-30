import { ApplicationConfig } from "@angular/core";
import { DEVICES_PROVIDER } from "@domains/catalog/compatibility";
import { DeviceService } from "./application";
import { DeviceApiService } from "./infrastructure/device-api.service";

export function provideCompatibilityFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: DEVICES_PROVIDER, useClass: DeviceApiService },
      DeviceService
    ]
  }
}