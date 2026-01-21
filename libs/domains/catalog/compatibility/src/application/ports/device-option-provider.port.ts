import { Observable } from "rxjs";
import { Result } from "@foundation/standard";
import { DeviceOptionDto } from "../models/device-option.dto";

export interface IDeviceOptionProvider {
  getDeviceOptions(): Observable<Result<DeviceOptionDto[], Error>>;
}



