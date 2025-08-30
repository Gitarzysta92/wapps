import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CategoryDto, ICategoriesProvider } from "@features/categories";
import { map, Observable } from "rxjs";
import { Result } from "@standard";
import { EnvironmentService } from "@portals/infrastructure/environment";

@Injectable()
export class CategoriesRestApi implements ICategoriesProvider {

  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(EnvironmentService);

  public getCategries(): Observable<Result<CategoryDto[], Error>  > {
    return this._http.get<CategoryDto[]>(`https://api.example.com/categories`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }
}