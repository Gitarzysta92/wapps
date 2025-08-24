import { Directive, inject } from "@angular/core";
import { SocialService } from "../application";

@Directive({
  selector: '[socialListContainer]',
  exportAs: 'socialListContainer'
})
export class SocialListContainerDirective {
  public readonly socials$ = inject(SocialService).socials$
}
