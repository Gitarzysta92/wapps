import { inject, Injectable } from "@angular/core";
import { ESTIMATED_USER_SPAN_PROVIDER } from "./ports/estimated-user-span-provider.port";
import { defer, map, shareReplay } from "rxjs";

@Injectable()
export class UserStatisticService {
  private readonly _estimatedUserProvider = inject(ESTIMATED_USER_SPAN_PROVIDER);

  public estimatedUsersSpan$ = defer(() => this._estimatedUserProvider.getEstimatedUserSpans())
    .pipe(
      map(r => r.value ?? []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
} 