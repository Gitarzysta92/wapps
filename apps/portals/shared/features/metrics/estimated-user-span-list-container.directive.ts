import { Directive, inject } from "@angular/core";
import { UserStatisticService } from "../../../../../libs/features/listing/statistic/users/application";

@Directive({
  selector: '[estimatedUserSpanListContainer]',
  exportAs: 'estimatedUserSpanListContainer'
})
export class EstimatedUserSpanListContainerDirective {
  public readonly estimatedUsersSpan$ = inject(UserStatisticService).estimatedUsersSpan$
}
