import { inject, Injectable } from "@angular/core";
import { defer, map, Observable, shareReplay } from "rxjs";
import { Result } from "@standard";
import { CategoryDto, ICategoriesProvider } from "@domains/catalog/category";
import { CATEGORIES_PROVIDER } from "./categories-provider.token";

@Injectable()
export class CategoriesService implements ICategoriesProvider {

  private readonly _service = inject(CATEGORIES_PROVIDER);

  public categories$ = defer(() => this._service.getCategries())
    .pipe(
      map(r => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  public getCategries(): Observable<Result<CategoryDto[], Error>> {
    return this._service.getCategries();
  }

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