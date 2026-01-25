import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { Result } from "@foundation/standard";
import { IAppListingProvider } from "../application";
import { AppListingQueryDto } from "../application/models/app-listing-query.dto";
import { AppListingSliceDto } from "../application/models/record-listing.dto";

interface BffPaginatedResponse {
  data: any[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

@Injectable()
export class AppListingBffApiService implements IAppListingProvider {
  private readonly _http = inject(HttpClient);
  private readonly _apiUrl = '/api'; // Routes through Kong to catalog-bff

  prefetchAppListing(r: AppListingQueryDto): void {
    // Optional: implement prefetch logic if needed
    console.log('Prefetch not yet implemented', r);
  }

  getAppListing(query: AppListingQueryDto): Observable<Result<AppListingSliceDto, Error>> {
    const { batchSize = 20, index = 0, query: filters } = query;
    const page = index + 1; // Convert zero-based index to one-based page
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', batchSize.toString());

    // Add filters from query
    if (filters) {
      if (filters['category']?.[0]) {
        params = params.set('category', filters['category'][0]);
      }
      if (filters['tags']?.length) {
        params = params.set('tags', filters['tags'].join(','));
      }
      if (filters['search']?.[0]) {
        params = params.set('search', filters['search'][0]);
      }
    }

    return this._http.get<BffPaginatedResponse>(`${this._apiUrl}/catalog/apps`, { params }).pipe(
      map(response => ({
        ok: true as const,
        value: {
          items: response.data.map(item => ({
            id: item.id,
            slug: item.slug,
            name: item.name,
            logo: item.logo,
            isPwa: item.isPwa ?? false,
            rating: item.rating ?? 0,
            reviews: item.reviewNumber ?? 0,
            tagIds: item.tagIds ?? [],
            categoryId: item.categoryId,
            platformIds: item.platformIds ?? []
          })),
          hash: this._createHash(filters || {}),
          count: response.data.length,
          index: index,
          maxCount: response.meta.pagination.total
        }
      })),
      catchError(err => of({ ok: false as const, error: err }))
    );
  }

  private _createHash(query: { [key: string]: string[] }): string {
    const str = JSON.stringify(query);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

