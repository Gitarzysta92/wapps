import { ParamMap } from "@angular/router";
import { Observable } from "rxjs";

export interface ISmartSearchState {
  queryParamMap$: Observable<ParamMap>;
  setQueryParams(p: { [key: string]: string }): void;
}

export interface ISmartSearchResultsProvider {
  getRecentSearches(): ISmartSearchResult;
  search(query: string): Observable<ISmartSearchResult>;
  buildSearchString(p: ParamMap): string | null;
  getSuggestions(partialQuery: string): Observable<string[]>;
  getSmartRecommendations(): Observable<ISmartSearchResult>;
}

export interface ISmartSearchResult {
  itemsNumber: number;
  groups: ISmartSearchResultGroup[];
  suggestions?: string[];
  smartRecommendations?: ISmartSearchResultGroup[];
}

export interface ISmartSearchResultGroup {
  id: number;
  name: string;
  entries: ISmartSearchResultEntry[];
  category?: string;
  relevanceScore?: number;
}

export interface ISmartSearchResultEntry {
  id: number;
  groupId: number;
  name: string;
  description: string;
  type: 'app' | 'category' | 'tag' | 'user' | 'other';
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

export interface ISmartSearchQuery {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
  includeSuggestions?: boolean;
  includeRecommendations?: boolean;
}
