import { inject, Injectable } from "@angular/core";
import { ESTIMATED_USER_SPAN_PROVIDER, IEstimatedUserSpanProvider } from "./ports/estimated-user-span-provider.port";
import { defer, map, shareReplay } from "rxjs";
import { isOk } from "@standard";

@Injectable()
export class UserStatisticService {
  private readonly _estimatedUserProvider = inject(ESTIMATED_USER_SPAN_PROVIDER) as IEstimatedUserSpanProvider;

  public estimatedUsersSpan$ = defer(() => this._estimatedUserProvider.getEstimatedUserSpans())
    .pipe(
      map(r => isOk(r) ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false }))
    ;
}
