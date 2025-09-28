import { ApplicationConfig } from "@angular/core";
import { SmartSearchService } from "./application/smart-search.service";
import { SmartSearchApiService } from "./infrastructure/smart-search.service";
import { SmartSearchStateService } from "./application/smart-search-state.service";
import { SMART_SEARCH_RESULTS_PROVIDER, SMART_SEARCH_STATE_PROVIDER } from "./application/smart-search.constants";

export function provideSmartSearchFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: SMART_SEARCH_RESULTS_PROVIDER, useClass: SmartSearchApiService },
      { provide: SMART_SEARCH_STATE_PROVIDER, useClass: SmartSearchStateService },
      SmartSearchService
    ]
  };
}
