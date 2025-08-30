import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { SearchCriteriaDto } from "../models/search-criteria.dto";
import { Result } from "@standard";

export const SEARCH_PROVIDER = new InjectionToken<ISearchProvider>('SEARCH_PROVIDER');

export interface ISearchProvider {
  search(c: SearchCriteriaDto): Observable<Result<boolean, Error>>;
}