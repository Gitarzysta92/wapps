import { Directive, inject } from "@angular/core";
import { UserStatisticService } from "../application";

@Directive({
  selector: '[estimatedUserSpanListContainer]',
  exportAs: 'estimatedUserSpanListContainer'
})
export class EstimatedUserSpanListContainerDirective {
  public readonly estimatedUsersSpan$ = inject(UserStatisticService).estimatedUsersSpan$
}
