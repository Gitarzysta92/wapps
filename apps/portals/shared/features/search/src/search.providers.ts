import { ApplicationConfig } from "@angular/core";
import { ListingSearchService } from "./application/listing-search.service";
import { SearchMockDataService } from "./infrastructure/search-mock-data.service";

export function provideSearchFeature(): ApplicationConfig {
  return {
    providers: [
      ListingSearchService,
      SearchMockDataService
    ]
  }
}
