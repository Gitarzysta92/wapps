import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { DeviceDto } from '../models/device.dto';

export interface IDevicesProvider {
  getDevices(): Observable<Result<DeviceDto[], Error>>;
}
