import { Directive, inject } from "@angular/core";
import { PlatformService } from "../application/platform.service";

@Directive({
  selector: '[platformListContainer]',
  exportAs: 'platformListContainer'
})
export class PlatformListContainerDirective {
  public readonly platforms$ = inject(PlatformService).platforms$
}
