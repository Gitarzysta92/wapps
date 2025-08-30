import { Directive, inject } from "@angular/core";
import { UserStatisticService } from "../application/user-statistic.service";

@Directive({
  selector: '[estimatedUserSpanListContainer]',
  exportAs: 'estimatedUserSpanListContainer'
})
export class EstimatedUserSpanListContainerDirective {
  public readonly estimatedUsersSpan$ = inject(UserStatisticService).estimatedUsersSpan$
}
