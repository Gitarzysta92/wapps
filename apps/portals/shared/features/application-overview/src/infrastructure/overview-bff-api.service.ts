import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Result } from '@standard';
import { IApplicationOverviewProvider } from "../application/overview-providers.port";
import { OverviewDto } from "../application/overview.dto";

@Injectable()
export class OverviewBffApiService implements IApplicationOverviewProvider {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = '/api'; // Routes through Kong to catalog-bff

  getOverview(appSlug: string): Observable<Result<OverviewDto, Error>> {
    return this._http.get<OverviewDto>(`${this._apiUrl}/catalog/apps/${appSlug}`).pipe(
      map(app => ({ ok: true as const, value: app })),
      catchError(err => of({ ok: false as const, error: err }))
    );
  }
}

