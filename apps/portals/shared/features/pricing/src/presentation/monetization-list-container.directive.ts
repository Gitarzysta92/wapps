import { Directive, inject } from "@angular/core";
import { MonetizationService } from "../../../../../libs/features/listing/monetization/application";

@Directive({
  selector: '[monetizationListContainer]',
  exportAs: 'monetizationListContainer'
})
export class MonetizationListContainerDirective {
  public readonly monetizations$ = inject(MonetizationService).monetizations$
}
