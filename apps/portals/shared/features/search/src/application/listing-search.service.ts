import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { ParamMap } from "@angular/router";
import { IMultiSearchResult } from "./models/search-results.interface";
import { SearchMockDataService } from "../infrastructure/search-mock-data.service";

@Injectable()
export class ListingSearchService {

  private readonly _httpClient = inject(HttpClient);
  private readonly _mockDataService = inject(SearchMockDataService);

  search(term: string): Observable<IMultiSearchResult> {
    return of(this._mockDataService.getAppListingSearchRecords()).pipe(delay(3000))
  }

  getRecentSearches(): IMultiSearchResult {
    return this._mockDataService.getAppListingSearchRecords()
  }

  buildSearchString(p: ParamMap): string | null {
    return p.get('pharse');
  }
}