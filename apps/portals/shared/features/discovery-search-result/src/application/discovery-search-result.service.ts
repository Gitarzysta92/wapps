import { inject, Injectable } from "@angular/core";
import { defer, map, Observable, shareReplay } from "rxjs";
import { Result } from "@foundation/standard";
import { DiscoverySearchResultDto, IDiscoverySearchResultProvider } from "@domains/discovery";
import { DISCOVERY_SEARCH_RESULT_PROVIDER } from "./discovery-search-result-provider.token";

@Injectable()
export class DiscoverySearchResultService implements IDiscoverySearchResultProvider {

  private readonly _service = inject(DISCOVERY_SEARCH_RESULT_PROVIDER);

  public searchResults$ = defer(() => this._service.getSearchResults())
    .pipe(
      map(r => r.ok ? r.value : []),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  public getSearchResults(): Observable<Result<DiscoverySearchResultDto[], Error>> {
    return this._service.getSearchResults();
  }

  public searchByQuery(query: string): Observable<Result<DiscoverySearchResultDto[], Error>> {
    return this._service.searchByQuery(query);
  }

  public getSearchResultById(id: number): Observable<DiscoverySearchResultDto | undefined> {
    return this.searchResults$.pipe(map(results => results.find((r: DiscoverySearchResultDto) => (r as any).id === id)));
  }
}

