import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { AppListingSliceDto } from "../models/app-listing.dto";
import { AppListingQueryDto } from "../models/app-listing-query.dto";

export const APP_LISTING_PROVIDER = new InjectionToken<IAppListingProvider>('APP_LISTING_PROVIDER_PORT');

export interface IAppListingProvider {
  getAppListing(r: AppListingQueryDto): Observable<Result<AppListingSliceDto, Error>>;
  prefetchAppListing(r: AppListingQueryDto): void;
}