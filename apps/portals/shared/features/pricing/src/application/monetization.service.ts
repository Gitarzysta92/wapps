import { inject, Injectable } from "@angular/core";

import { defer, map, shareReplay } from "rxjs";
import { MONETIZATION_PROVIDER } from "./monetization-provider.port";

@Injectable()
export class MonetizationService {
  private readonly _monetizationsProvider = inject(MONETIZATION_PROVIDER);

  public monetizations$ = defer(() => this._monetizationsProvider.getMonetizations())
    .pipe(
      map(r => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 