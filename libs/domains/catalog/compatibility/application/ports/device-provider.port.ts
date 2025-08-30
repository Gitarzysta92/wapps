import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { DeviceDto } from "../models/device.dto";

export const DEVICES_PROVIDER = new InjectionToken<IDevicesProvider>('DEVICES_PROVIDER_PORT');

export interface IDevicesProvider {
  getDevices(): Observable<Result<DeviceDto[], Error>>;
}

