import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CATALOG_API_URL } from './catalog-api-url.token';
import { AppRecordDto, PaginatedAppsResponse } from './catalog.dto';

/**
 * API client for catalog-bff.
 * Base URL includes /api; routes: /api/catalog/apps, /api/catalog/apps/:slug.
 */
@Injectable({
  providedIn: 'root',
})
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(CATALOG_API_URL);

  getApps(params?: {
    page?: number;
    pageSize?: number;
    category?: string;
    tags?: string[];
    search?: string;
  }): Observable<PaginatedAppsResponse<AppRecordDto>> {
    if (!this.apiUrl) {
      return throwError(() => new Error('Catalog API URL is not configured'));
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 1000; // whole list for now (no pagination in UI)
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('pageSize', pageSize.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.tags?.length) queryParams.append('tags', params.tags.join(','));
    if (params?.search) queryParams.append('search', params.search);

    const url = `${this.apiUrl}/catalog/apps?${queryParams.toString()}`;
    return this.http.get<PaginatedAppsResponse<AppRecordDto>>(url);
  }

  getAppBySlug(slug: string): Observable<AppRecordDto | null> {
    if (!this.apiUrl) {
      return throwError(() => new Error('Catalog API URL is not configured'));
    }

    return this.http
      .get<AppRecordDto>(`${this.apiUrl}/catalog/apps/${slug}`)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            return of(null);
          }
          return throwError(() => err);
        })
      );
  }
}
