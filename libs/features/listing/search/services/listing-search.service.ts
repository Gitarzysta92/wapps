import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { appListingSearchRecordsV2 } from "../../../../../applications/web-client/data/app-listing";
import { ParamMap } from "@angular/router";
import { IMultiSearchResultsProvider, IMultiSearchResult } from "../../../../ui/components/multi-search/multi-search.interface";

@Injectable()
export class ListingSearchService implements IMultiSearchResultsProvider {

  private readonly _httpClient = inject(HttpClient);

  search(term: string): Observable<IMultiSearchResult> {
    return of(appListingSearchRecordsV2).pipe(delay(3000))
  }

  getRecentSearches(): IMultiSearchResult {
    return appListingSearchRecordsV2
  }

  buildSearchString(p: ParamMap): string | null {
    return p.get('pharse');
  }
}