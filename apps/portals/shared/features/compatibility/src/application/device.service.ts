import { inject, Injectable } from "@angular/core";
import { defer, map, shareReplay } from "rxjs";
import { Result } from "@foundation/standard";
import { PLATFORMS_PROVIDER } from "./platforms-provider.token";

@Injectable()
export class DeviceService {
  private readonly _devicesProvider = inject(PLATFORMS_PROVIDER);

  public devices$ = defer(() => this._devicesProvider.getPlatforms())
    .pipe(
      map((r: Result<{ id: number; name: string }[], Error>) => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 