import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Result } from "@standard";
import { Observable, of, map, catchError } from "rxjs";
import { CustomerFavoritesDto } from "@domains/customer/favorites";
import { MY_FAVORITES_API_BASE_URL_PROVIDER } from "../application/infrastructure-providers.port";
import { IMyFavoritesProvider } from "../application/my-favorites-provider.port";

@Injectable()
export class MyFavoritesApiService implements IMyFavoritesProvider {

  private readonly _httpClient = inject(HttpClient);
  private readonly _apiBaseUrl = inject(MY_FAVORITES_API_BASE_URL_PROVIDER);
  
  public getMyFavorites(): Observable<Result<CustomerFavoritesDto>> {
    // TODO: Replace with actual API call
    return of({
      ok: true,
      value: {
        applications: ["app-1", "app-2"],
        suites: ["suite-1"],
        articles: ["article-1", "article-2", "article-3"],
        discussions: ["discussion-1"]
      },
    });
    
    // Real implementation:
    // return this._httpClient.get<CustomerFavoritesDto>(`${this._apiBaseUrl}/favorites`).pipe(
    //   map(data => ({ ok: true, value: data } as Result<CustomerFavoritesDto>)),
    //   catchError(error => of({ ok: false, error } as Result<CustomerFavoritesDto>))
    // );
  }

  public addToFavorites(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<Result<boolean, Error>> {
    // TODO: Replace with actual API call
    console.log(`Adding ${slug} to ${type} favorites`);
    return of({ ok: true, value: true });
    
    // Real implementation:
    // return this._httpClient.post<void>(`${this._apiBaseUrl}/favorites/${type}/${slug}`, {}).pipe(
    //   map(() => ({ ok: true, value: true } as Result<boolean, Error>)),
    //   catchError(error => of({ ok: false, error } as Result<boolean, Error>))
    // );
  }

  public removeFromFavorites(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<Result<boolean, Error>> {
    // TODO: Replace with actual API call
    console.log(`Removing ${slug} from ${type} favorites`);
    return of({ ok: true, value: true });
    
    // Real implementation:
    // return this._httpClient.delete<void>(`${this._apiBaseUrl}/favorites/${type}/${slug}`).pipe(
    //   map(() => ({ ok: true, value: true } as Result<boolean, Error>)),
    //   catchError(error => of({ ok: false, error } as Result<boolean, Error>))
    // );
  }
}

