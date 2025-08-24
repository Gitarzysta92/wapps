import { ApplicationConfig } from "@angular/core";
import { DEVICES_PROVIDER, DeviceService } from "./application";
import { DeviceApiService } from "./infrastructure/device-api.service";

export function provideListingDeviceFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: DEVICES_PROVIDER, useClass: DeviceApiService },
      DeviceService
    ]
  }
}