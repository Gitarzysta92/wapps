import { ParamMap } from "@angular/router";
import { Observable } from "rxjs";

export interface IMultiSearchState {
  queryParamMap$: Observable<ParamMap>;
  setQueryParams(p: { [key: string]: string }): void;
}

export interface IMultiSearchResultsProvider {
  getRecentSearches(): IMultiSearchResult;
  search(p: string): Observable<IMultiSearchResult>;
  buildSearchString(p: ParamMap): string | null
}

export interface IMultiSearchResult {
  itemsNumber: number;
  groups: IMultiSearchResultGroup[];
}

export interface IMultiSearchResultGroup {
  id: number;
  name: string;
  entries: IMultiSearchResultEntry[];
}

export interface IMultiSearchResultEntry {
  id: number;
  groupId: number;
  name: string;
  description: string;
}