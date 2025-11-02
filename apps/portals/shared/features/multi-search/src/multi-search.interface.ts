import { Observable } from "rxjs";
import { AddTypeToArray, Result } from "@standard";
import { DiscoverySearchResultDto, DiscoverySearchResultGroupDto } from "@domains/discovery";

export interface IMultiSearchState {
  queryParamMap$: Observable<{ [key: string]: string }>;
  setQueryParams(p: { [key: string]: string | null }): void;
}


export interface IMultiSearchResultsProvider {
  getRecentSearches(): Observable<Result<MultiSearchResultVM>>;
  search(p: { [key: string]: string }): Observable<Result<MultiSearchResultVM>>;
}


type MultiSearchResultGroupVM = Omit<DiscoverySearchResultGroupDto, 'entries'> &
{ entries: AddTypeToArray<DiscoverySearchResultGroupDto['entries'], { link: string }> }


export type MultiSearchResultVM = Omit<DiscoverySearchResultDto, 'groups'> & {
  groups: Array<MultiSearchResultGroupVM & { link: string }>
}