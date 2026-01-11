import { AppPreviewDto, AppRecordDto, IRecordsProvider, RECORD_SUBDOMAIN_SLUG } from '@domains/catalog/record';
import { map, Observable, of } from 'rxjs';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Result } from "@standard";
import { API_BASE_URL } from '@portals/shared/boundary/http';

export class ApiService implements IRecordsProvider {
  getRecordPreview(slug: string): Observable<Result<AppPreviewDto, Error>> {
    return of({ ok: true, value: {} as any });
  }
  private readonly _http = inject(HttpClient);
  private readonly _apiBaseUrl = inject(API_BASE_URL);

  public getRecord(slug: string): Observable<Result<AppRecordDto, Error>> {
    return this._http.get<AppRecordDto>(`${this._apiBaseUrl}/${RECORD_SUBDOMAIN_SLUG}/${slug}`).pipe(
      map(r => ({ ok: true, value: r }))
    );
  }

  // public getRecordPreview(slug: string): Observable<Result<AppPreviewDto[], Error>> {
  //   return of({ ok: true, value: [] });
  // }
}