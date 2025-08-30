import { Directive, inject } from "@angular/core";
import { PlatformService } from "@features/listing";
import { asyncScheduler, delay, observeOn, tap } from "rxjs";

@Directive({
  selector: '[platformListContainer]',
  exportAs: 'platformListContainer'
})
export class PlatformListContainerDirective {
  public readonly platforms$ = inject(PlatformService).platforms$
}
