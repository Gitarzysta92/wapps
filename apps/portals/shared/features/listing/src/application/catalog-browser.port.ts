import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import {
  CatalogEntry,
  CatalogFacet,
  CatalogKind,
  CatalogQuery,
} from './catalog-listing';
import {
  CatalogDirectoryEntry,
  CatalogDirectoryKind,
} from './catalog-directory';

export interface CatalogListingPage {
  items: CatalogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: Record<
    'categories' | 'tags' | 'platforms' | 'devices' | 'monetizations',
    CatalogFacet[]
  >;
}

export interface CatalogBrowserPort {
  readonly mode: 'api' | 'demo';
  readonly kinds: readonly CatalogKind[];
  browse(query: CatalogQuery): Observable<Result<CatalogListingPage, Error>>;
  directory(
    kind: CatalogDirectoryKind
  ): Observable<Result<CatalogDirectoryEntry[], Error>>;
}

export const CATALOG_BROWSER = new InjectionToken<CatalogBrowserPort>(
  'CATALOG_BROWSER'
);
export const CATALOG_API_URL = new InjectionToken<string>('CATALOG_API_URL');
export const DEMO_CATALOG_ENTRIES = new InjectionToken<
  () => readonly CatalogEntry[]
>('DEMO_CATALOG_ENTRIES');
