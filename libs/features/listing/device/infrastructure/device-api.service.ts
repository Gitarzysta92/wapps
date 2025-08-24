import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { Result } from "../../../../utils/utility-types";
import { IDevicesProvider, DeviceDto } from "../application";

@Injectable()
export class DeviceApiService implements IDevicesProvider {

  public getDevices(): Observable<Result<DeviceDto[], Error>> {
    return of({
      value: [
        { id: 0, name: "Desktop" },
        { id: 1, name: "Tablet" },
        { id: 2, name: "Phone" },
        { id: 3, name: "Smartwatch" },
        { id: 4, name: "Tv" }
      ],
    })
  }
  
}