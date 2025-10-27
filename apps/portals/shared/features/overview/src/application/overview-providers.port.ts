import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { OverviewDto } from "./overview.dto";

export const OVERVIEW_PROVIDER = new InjectionToken<IOverviewProvider>('OVERVIEW_PROVIDER');

export interface IOverviewProvider {
  getOverview(appSlug: string): Observable<Result<OverviewDto, Error>>
}
