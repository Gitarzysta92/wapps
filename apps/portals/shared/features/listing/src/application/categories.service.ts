import { inject, Injectable } from "@angular/core";
import { defer, map, Observable, shareReplay } from "rxjs";
import { CategoryDto } from "@domains/catalog/category";
import { CategoryApiService } from "../infrastructure/category-api.service";

@Injectable()
export class CategoriesService {

  private readonly _service = inject(CategoryApiService);

  public categories$ = defer(() => this._service.getCategories())
    .pipe(
      map(r => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  public getCategories(): Observable<CategoryDto[]> {
    return this.categories$;
  }

  public getCategoryChildren(categoryId: number): Observable<CategoryDto[]> {
    return this.getCategories().pipe(map(cs => cs.filter(c => c.parentId === categoryId)))
  }

  public getCategory(categoryId: number): Observable<CategoryDto> {
    return this.getCategories().pipe(map(cs => cs.find(c => c.id === categoryId)!))
  }
}