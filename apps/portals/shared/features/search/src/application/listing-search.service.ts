import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { ParamMap } from "@angular/router";
import { SearchMockDataService } from "../infrastructure/search-mock-data.service";
import { SearchResultDto } from "@domains/catalog/search";

@Injectable()
export class ListingSearchService {

  private readonly _httpClient = inject(HttpClient);
  private readonly _mockDataService = inject(SearchMockDataService);

  search(term: string): Observable<SearchResultDto> {
    return of(this._mockDataService.getAppListingSearchRecords()).pipe(delay(3000))
  }

  getRecentSearches(): SearchResultDto {
    return this._mockDataService.getAppListingSearchRecords()
  }

  buildSearchString(p: ParamMap): string | null {
    return p.get('pharse');
  }
}