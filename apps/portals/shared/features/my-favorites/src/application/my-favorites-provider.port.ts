import { Observable } from "rxjs";
import { Result } from "@standard";
import { CustomerFavoritesDto } from "@domains/customer/favorites";

export interface IMyFavoritesProvider {
  getMyFavorites(): Observable<Result<CustomerFavoritesDto>>;
  addToFavorites(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<Result<boolean, Error>>;
  removeFromFavorites(type: 'applications' | 'suites' | 'articles' | 'discussions', slug: string): Observable<Result<boolean, Error>>;
}

