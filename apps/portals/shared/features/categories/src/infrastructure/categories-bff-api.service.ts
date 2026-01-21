import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Result } from "@foundation/standard";
import { CategoryDto, ICategoriesProvider } from "@domains/catalog/category";

@Injectable()
export class CategoriesBffApiService implements ICategoriesProvider {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = '/api'; // Routes through Kong to catalog-bff

  getCategories(): Observable<Result<CategoryDto[], Error>> {
    return this._http.get<CategoryDto[]>(`${this._apiUrl}/catalog/categories`).pipe(
      map(categories => ({ ok: true as const, value: categories })),
      catchError(err => of({ ok: false as const, error: err }))
    );
  }
}

