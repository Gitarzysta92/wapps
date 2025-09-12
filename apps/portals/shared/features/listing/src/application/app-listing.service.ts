import { inject, Injectable } from "@angular/core";
import { map, Observable, tap } from "rxjs";

import { APP_LISTING_PROVIDER } from "./app-listing-provider.port";
import { AppListingQueryDto } from "./models/app-listing-query.dto";
import { AppListingSliceDto } from "./models/record-listing.dto";

@Injectable()
export class AppListingService {

  private readonly _appListingProvider = inject(APP_LISTING_PROVIDER);
  
  public getApps(rDto: AppListingQueryDto, prefetch: number[] = []): Observable<AppListingSliceDto> {
    return this._appListingProvider.getAppListing(rDto)
      .pipe(
        map(r => r.ok ? r.value : {
          items: [],
          count: 0,
          maxCount: 0,
          hash: '',
          index: 0
        }),
        tap(r => {
          for (let page of prefetch) {
            this._appListingProvider.prefetchAppListing({
              ...rDto,
              index: page
            })
          }
        })
      )
  }

}