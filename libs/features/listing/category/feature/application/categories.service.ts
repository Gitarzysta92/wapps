import { inject, Injectable } from "@angular/core";
import { CATEGORIES_PROVIDER } from "./ports";
import { defer, map, Observable, shareReplay } from "rxjs";
import { CategoryDto } from "./models/category.dto";

@Injectable()
export class CategoriesService {

  private readonly _service = inject(CATEGORIES_PROVIDER);

  public categories$ = defer(() => this._service.getCategries())
    .pipe(
      map(r => r.value ?? []),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  public getCategories(): Observable<CategoryDto[]> {
    return this.categories$;
  }

  public getCategoryChildren(categoryId: number): Observable<CategoryDto[]> {
    return this.getCategories().pipe(map(cs => cs.find(c => c.id === categoryId)?.childs ?? []))
  }

  public getCategory(categoryId: number): Observable<CategoryDto> {
    return this.getCategories().pipe(map(cs => cs.find(c => c.id === categoryId)!))
  }
}