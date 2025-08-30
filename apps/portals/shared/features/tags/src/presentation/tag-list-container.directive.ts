import { Directive, inject } from "@angular/core";
import { TagsService } from "../application/tags.service";

@Directive({
  selector: '[tagListContainer]',
  exportAs: 'tagListContainer'
})
export class TagListContainerDirective {
  public readonly tags$ = inject(TagsService).tags$
}
