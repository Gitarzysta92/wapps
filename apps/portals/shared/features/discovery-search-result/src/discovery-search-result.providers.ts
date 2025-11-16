import { ApplicationConfig } from "@angular/core";

import { DiscoverySearchResultService } from "./application/discovery-search-result.service";
import { DiscoverySearchResultApiService } from "./infrastructure/discovery-search-result.restapi";
import { DISCOVERY_SEARCH_RESULT_PROVIDER } from "./application/discovery-search-result-provider.token";
import { DISCOVERY_SEARCH_RESULT_PATH } from "./presentation/discovery-search-result-path.token";
import { DiscoverySearchResultDtoToViewModelMapper } from "./presentation/mappings/discovery-search-result-dto-to-view-model.mapper";

export function provideDiscoverySearchResultFeature(c: { path: string }): ApplicationConfig {
  return {
    providers: [
      { provide: DISCOVERY_SEARCH_RESULT_PATH, useValue: c.path },
      { provide: DISCOVERY_SEARCH_RESULT_PROVIDER, useClass: DiscoverySearchResultApiService },
      DiscoverySearchResultDtoToViewModelMapper,
      DiscoverySearchResultService
    ]
  }
}

