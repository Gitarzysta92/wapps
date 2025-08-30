import { Directive, inject } from "@angular/core";
import { SocialService } from "../../../../../../../libs/features/listing/social/application";

@Directive({
  selector: '[socialListContainer]',
  exportAs: 'socialListContainer'
})
export class SocialListContainerDirective {
  public readonly socials$ = inject(SocialService).socials$
}
