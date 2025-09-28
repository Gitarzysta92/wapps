export interface ISmartSearchResultsProvider {
  search(query: string): Promise<any>;
  getSuggestions(partialQuery: string): Promise<string[]>;
  getSmartRecommendations(): Promise<any[]>;
  getRecentSearches(): Promise<string[]>;
  buildSearchString(paramMap: Map<string, any>): string;
}

export interface ISmartSearchState {
  query: string;
  results: any;
  suggestions: string[];
  recommendations: any[];
  recentSearches: string[];
  isLoading: boolean;
  error: string | null;
  queryParamMap$: any;
  setQueryParams(params: any): void;
}

export interface ISmartSearchResult {
  groups: any[];
  itemsNumber: number;
  suggestions: string[];
}
