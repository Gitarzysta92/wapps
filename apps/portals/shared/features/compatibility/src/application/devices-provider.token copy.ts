import { InjectionToken } from "@angular/core";
import { IDevicesProvider } from "@domains/catalog/compatibility";

export const DEVICES_PROVIDER = new InjectionToken<IDevicesProvider>('DEVICES_PROVIDER');