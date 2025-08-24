import { Directive, inject } from "@angular/core";
import { CategoriesService } from "../application";

@Directive({
  selector: '[categoryListContainer]',
  exportAs: 'categoryListContainer'
})
export class CategoryListContainerDirective {
  public readonly categories$ = inject(CategoriesService).categories$;
}
