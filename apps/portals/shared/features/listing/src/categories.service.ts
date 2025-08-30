import { inject, Injectable } from "@angular/core";
import { defer, map, Observable, shareReplay } from "rxjs";
import { CategoriesRestApi } from "../../categories/src/infrastructure/categories.restapi";
import { CategoryDto } from "@features/categories";

@Injectable()
export class CategoriesService {

  private readonly _service = inject(CategoriesRestApi);

  public categories$ = defer(() => this._service.getCategries())
    .pipe(
      map(r => r.ok ? r.value : []),
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