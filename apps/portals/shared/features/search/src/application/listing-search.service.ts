import { inject, Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ParamMap } from "@angular/router";
import { SearchMockDataService } from "../infrastructure/search-mock-data.service";
import { SearchResultDto } from "@domains/catalog/search";

@Injectable()
export class ListingSearchService  {

  private readonly _mockDataService = inject(SearchMockDataService);

  search(term: string): Observable<SearchResultDto> {

    const terms = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return of({ records: this._mockDataService.getAppListingSearchRecords().records.filter(record =>
      terms.every(word => `${record.name} ${record.description}`.toLowerCase().includes(word))
    ) });
  }

  getRecentSearches(): SearchResultDto {
    return this._mockDataService.getAppListingSearchRecords()
  }

  buildSearchString(p: ParamMap): string | null {
    return p.get('search') ?? p.get('phrase') ?? p.get('pharse');
  }
}