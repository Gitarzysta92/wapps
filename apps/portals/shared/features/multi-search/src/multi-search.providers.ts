import { ApplicationConfig } from "@angular/core";
import { SearchMockDataService } from "@portals/shared/features/search";

export function provideMultiSearchFeature(): ApplicationConfig {
  return {
    providers: [
      SearchMockDataService
    ]
  }
}