import { ApplicationConfig } from "@angular/core";
import { ParamMapToAppListingRequestDtoMapper } from "./presentation/mappings/param-map-to-app-listing-request-dto.mapper";
import { AppListingService } from "./application/app-lisiting.service";
import { PAGE_NUMBER_PARAM_KEY } from "./presentation/ports/page-number-param-key.port";
import { APP_LISTING_PROVIDER } from "./application/ports/app-listing-provider.port";
import { AppListingApiService } from "./infrastructure/app-lisiting-api.service";


export function provideFilterAppFeature(o: {
  pageNumberParamKey: string
}): ApplicationConfig {
  return {
    providers: [
      ParamMapToAppListingRequestDtoMapper,
      AppListingService,
      { provide: PAGE_NUMBER_PARAM_KEY, useValue: o.pageNumberParamKey },
      { provide: APP_LISTING_PROVIDER, useClass: AppListingApiService }
    ]
  }
}