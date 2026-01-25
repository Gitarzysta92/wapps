import { map, Observable } from "rxjs";
import { IApplicationOverviewProvider } from "../application/overview-providers.port";
import { Result } from '@foundation/standard'
import { OverviewDto } from "../application/overview.dto";
import { OVERVIEW_API_URL } from "./overview-api-url.port";
import { inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";

export class OverviewApiService implements IApplicationOverviewProvider {

  private readonly _http = inject(HttpClient);
  private readonly _overviewApiUrl = inject(OVERVIEW_API_URL);

  getOverview(appSlug: string): Observable<Result<OverviewDto, Error>> {
    return this._http.get<OverviewDto>(`${this._overviewApiUrl}/${appSlug}`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }

}

