import { ApplicationConfig } from "@angular/core";
import { SmartSearchService } from "./application/smart-search.service";
import { SmartSearchApiService } from "./infrastructure/smart-search.service";
import { SMART_SEARCH_RESULTS_PROVIDER } from "./application/smart-search.constants";

export function provideSmartSearchFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: SMART_SEARCH_RESULTS_PROVIDER, useClass: SmartSearchApiService },
      SmartSearchService
    ]
  };
}
