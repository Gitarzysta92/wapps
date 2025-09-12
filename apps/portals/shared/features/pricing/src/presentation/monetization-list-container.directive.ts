import { Directive, inject } from "@angular/core";
import { MonetizationService } from "../application/monetization.service";


@Directive({
  selector: '[monetizationListContainer]',
  exportAs: 'monetizationListContainer'
})
export class MonetizationListContainerDirective {
  public readonly monetizations$ = inject(MonetizationService).monetizations$
}
