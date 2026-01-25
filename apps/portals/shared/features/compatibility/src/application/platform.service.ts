import { inject, Injectable } from "@angular/core";
import { defer, map, shareReplay } from "rxjs";
import { isOk } from "@foundation/standard";
import { PLATFORMS_PROVIDER } from "./platforms-provider.token";

@Injectable()
export class PlatformService {
  private readonly _platformsProvider = inject(PLATFORMS_PROVIDER);

  public platforms$ = defer(() => this._platformsProvider.getPlatforms())
    .pipe(
      map(r => isOk(r) ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 