import { inject, Injectable } from "@angular/core";

import { defer, map, shareReplay } from "rxjs";
import { SOCIALS_PROVIDER } from "./ports/social-provider.port";

@Injectable()
export class SocialService {
  private readonly _socialsProvider = inject(SOCIALS_PROVIDER);

  public socials$ = defer(() => this._socialsProvider.getSocials())
    .pipe(
      map(r => r.value ?? []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 