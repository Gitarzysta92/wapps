import { inject, Injectable } from "@angular/core";
import { DEVICES_PROVIDER } from "@domains/catalog/compatibility";
import { defer, map, shareReplay } from "rxjs";
import { Result } from "@standard";

@Injectable()
export class DeviceService {
  private readonly _devicesProvider = inject(DEVICES_PROVIDER);

  public devices$ = defer(() => this._devicesProvider.getDevices())
    .pipe(
      map((r: Result<{ id: number; name: string }[], Error>) => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 