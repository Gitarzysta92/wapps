import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { Result } from "@foundation/standard";
import { DiscoverySearchResultDto, IDiscoverySearchResultProvider } from "@domains/discovery";

@Injectable()
export class DiscoverySearchResultRestApi implements IDiscoverySearchResultProvider {

  private readonly _http = inject(HttpClient);

  public getSearchResults(): Observable<Result<DiscoverySearchResultDto[], Error>> {
    return this._http.get<DiscoverySearchResultDto[]>(`https://api.example.com/discovery/search`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }

  public searchByQuery(query: string): Observable<Result<DiscoverySearchResultDto[], Error>> {
    return this._http.get<DiscoverySearchResultDto[]>(`https://api.example.com/discovery/search?q=${query}`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }
}

@Injectable()
export class DiscoverySearchResultApiService implements IDiscoverySearchResultProvider {
  getSearchResults(): Observable<Result<DiscoverySearchResultDto[], Error>> {
    return of({
      ok: true,
      value: []
    });
  }

  searchByQuery(query: string): Observable<Result<DiscoverySearchResultDto[], Error>> {
    return of({
      ok: true,
      value: []
    });
  }
}

