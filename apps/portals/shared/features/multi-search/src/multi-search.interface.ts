import { Observable } from "rxjs";
import { SearchResultGroupVM, SearchResultVM } from '@ui/search-results';
import { AddTypeToArray, Result } from "@standard";

export interface IMultiSearchState {
  queryParamMap$: Observable<{ [key: string]: string }>;
  setQueryParams(p: { [key: string]: string }): void;
}


export interface IMultiSearchResultsProvider {
  getRecentSearches(): Observable<Result<MultiSearchResultVM>>;
  search(p: { [key: string]: string }): Observable<Result<MultiSearchResultVM>>;
}


type MultiSearchResultGroupVM = Omit<SearchResultGroupVM, 'entries'> &
{ entries: AddTypeToArray<SearchResultGroupVM['entries'], { link: string }> }


export type MultiSearchResultVM = Omit<SearchResultVM, 'groups'> & {
  groups: Array<MultiSearchResultGroupVM & { link: string }>
}