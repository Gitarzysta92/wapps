import { inject, Injectable } from "@angular/core";
import { DiscoverySearchResultDto } from "@domains/discovery";
import { DiscoverySearchResultVm } from "../models/discovery-search-result.vm";
import { DISCOVERY_SEARCH_RESULT_PATH } from "../discovery-search-result-path.token";

@Injectable()
export class DiscoverySearchResultDtoToViewModelMapper {
  private readonly _searchResultPath = inject(DISCOVERY_SEARCH_RESULT_PATH);
  map(result: DiscoverySearchResultDto): DiscoverySearchResultVm {
    // Build path from query parameters
    const queryParams = new URLSearchParams(result.query).toString();
    const path = queryParams ? `${this._searchResultPath}?${queryParams}` : this._searchResultPath;
    
    return {
      ...result,
      path
    }
  }
}

