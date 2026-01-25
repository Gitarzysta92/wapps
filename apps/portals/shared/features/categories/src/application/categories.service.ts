import { inject, Injectable } from "@angular/core";
import { defer, map, Observable, shareReplay } from "rxjs";
import { Result } from "@foundation/standard";
import { CategoryDto, ICategoriesProvider } from "@domains/catalog/category";
import { CATEGORIES_PROVIDER } from "./categories-provider.token";

@Injectable()
export class CategoriesService implements ICategoriesProvider {

  private readonly _service = inject(CATEGORIES_PROVIDER);

  public categories$ = defer(() => this._service.getCategories())
    .pipe(
      map(r => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  public getCategories(): Observable<Result<CategoryDto[], Error>> {
    return this._service.getCategories();
  }

  private _getCategories(): Observable<CategoryDto[]> {
    return this.categories$;
  }

  public getCategoryChildren(categoryId: number): Observable<CategoryDto[]> {
    return this._getCategories().pipe(map(cs => cs.filter(c => c.parentId === categoryId)))
  }

  public getCategory(categoryId: number): Observable<CategoryDto> {
    return this._getCategories().pipe(map(cs => cs.find(c => c.id === categoryId)!))
  }
}