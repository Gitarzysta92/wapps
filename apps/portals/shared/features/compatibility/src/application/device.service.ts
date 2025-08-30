import { inject, Injectable } from "@angular/core";
import { DEVICES_PROVIDER } from "./ports/device-provider.port";
import { defer, map, shareReplay } from "rxjs";

@Injectable()
export class DeviceService {
  private readonly _devicesProvider = inject(DEVICES_PROVIDER);

  public devices$ = defer(() => this._devicesProvider.getDevices())
    .pipe(
      map(r => r.value ?? []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 