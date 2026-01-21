import { Injectable } from "@angular/core";
import { Observable, of, map } from "rxjs";
import { Result } from "@foundation/standard";
import { IDevicesProvider, DeviceDto, IPlatformsProvider, PlatformDto } from "@domains/catalog/compatibility";

@Injectable()
export class DeviceApiService implements IDevicesProvider, IPlatformsProvider {

  public getDevices(): Observable<Result<DeviceDto[], Error>> {
    return of({
      ok: true,
      value: [
        { id: 0, name: "Desktop" },
        { id: 1, name: "Tablet" },
        { id: 2, name: "Phone" },
        { id: 3, name: "Smartwatch" },
        { id: 4, name: "Tv" }
      ],
    })
  }

  public getPlatforms(): Observable<Result<PlatformDto[], Error>> {
    // For DeviceService compatibility, return devices as platforms
    return this.getDevices().pipe(
      map(result => {
        if (result.ok) {
          return {
            ok: true as const,
            value: result.value.map(device => ({ id: device.id, name: device.name }))
          } as Result<PlatformDto[], Error>;
        }
        return result as Result<PlatformDto[], Error>;
      })
    );
  }
  
}