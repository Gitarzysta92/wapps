import { inject, Injectable } from "@angular/core";
import { PLATFORMS_PROVIDER } from "./ports/platforms-provider.port";
import { defer, map, shareReplay } from "rxjs";

@Injectable()
export class PlatformService {
  private readonly _platformsProvider = inject(PLATFORMS_PROVIDER);

  public platforms$ = defer(() => this._platformsProvider.getPlatforms())
    .pipe(
      map(r => r.value ?? []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 