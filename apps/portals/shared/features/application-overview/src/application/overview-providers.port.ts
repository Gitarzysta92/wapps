import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { OverviewDto } from "./overview.dto";

export const APPLICATION_OVERVIEW_PROVIDER = new InjectionToken<IApplicationOverviewProvider>('APPLICATION_OVERVIEW_PROVIDER');

export interface IApplicationOverviewProvider {
  getOverview(appSlug: string): Observable<Result<OverviewDto, Error>>
}

