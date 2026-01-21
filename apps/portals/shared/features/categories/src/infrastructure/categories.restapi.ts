import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { Result } from "@foundation/standard";
import { CategoryDto, ICategoriesProvider } from "@domains/catalog/category";
import { CATEGORIES } from "@portals/shared/data";

@Injectable()
export class CategoriesRestApi implements ICategoriesProvider {

  private readonly _http = inject(HttpClient);

  public getCategories(): Observable<Result<CategoryDto[], Error>> {
    return this._http.get<CategoryDto[]>(`https://api.example.com/categories`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }
}

@Injectable()
export class CategoryApiService implements ICategoriesProvider {
  getCategories(): Observable<Result<CategoryDto[], Error>> {
    return of({
      ok: true,
      value: CATEGORIES
    });
  }
}