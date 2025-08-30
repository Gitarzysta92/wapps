import { Directive, inject } from "@angular/core";
import { DeviceService } from "../application";

@Directive({
  selector: '[deviceListContainer]',
  exportAs: 'deviceListContainer'
})
export class DeviceListContainerDirective {
  public readonly devices$ = inject(DeviceService).devices$
}
