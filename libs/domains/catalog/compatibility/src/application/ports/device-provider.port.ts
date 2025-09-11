import { Observable } from "rxjs";
import { Result } from "@standard";
import { DeviceDto } from "../models/device.dto";


export interface IDevicesProvider {
  getDevices(): Observable<Result<DeviceDto[], Error>>;
}

