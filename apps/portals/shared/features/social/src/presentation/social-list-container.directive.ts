import { Directive, inject } from "@angular/core";
import { SocialService } from "../application/social.service";

@Directive({
  selector: '[socialListContainer]',
  exportAs: 'socialListContainer'
})
export class SocialListContainerDirective {
  public readonly socials$ = inject(SocialService).socials$
}
