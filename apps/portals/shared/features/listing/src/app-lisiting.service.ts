import { inject, Injectable } from "@angular/core";
import { APP_LISTING_PROVIDER } from "../../../../../../libs/features/listing/app/application/ports/app-listing-provider.port";
import { map, Observable, tap } from "rxjs";
import { AppListingQueryDto } from "./models/app-listing-query.dto";
import { AppListingSliceDto } from "./models/app-listing.dto";

@Injectable()
export class AppListingService {

  private readonly _appListingProvider = inject(APP_LISTING_PROVIDER);
  
  public getApps(rDto: AppListingQueryDto, prefetch: number[] = []): Observable<AppListingSliceDto> {
    return this._appListingProvider.getAppListing(rDto)
      .pipe(
        map(r => r.value),
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