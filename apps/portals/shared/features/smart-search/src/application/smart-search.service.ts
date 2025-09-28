import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { ISmartSearchResultsProvider, ISmartSearchResult } from '../smart-search.interface';
import { SMART_SEARCH_RESULTS_PROVIDER } from './smart-search.constants';
import { SMART_SEARCH_CONFIG } from './smart-search.constants';

@Injectable({
  providedIn: 'root'
})
export class SmartSearchService {
  private readonly _searchResultsProvider = inject(SMART_SEARCH_RESULTS_PROVIDER);

  /**
   * Performs a smart search query
   * @param query The search query parameters
   * @returns Observable of search results
   */
  search(query: { query: string }): Observable<ISmartSearchResult> {
    return from(this._searchResultsProvider.search(query.query));
  }

  /**
   * Gets search suggestions based on partial query
   * @param partialQuery Partial search query
   * @returns Observable of suggestions
   */
  getSuggestions(partialQuery: string): Observable<string[]> {
    if (partialQuery.length < SMART_SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      return new Observable(observer => observer.next([]));
    }
    return from(this._searchResultsProvider.getSuggestions(partialQuery));
  }

  /**
   * Gets smart recommendations
   * @returns Observable of smart recommendations
   */
  getSmartRecommendations(): Observable<any[]> {
    return from(this._searchResultsProvider.getSmartRecommendations());
  }

  /**
   * Gets recent searches
   * @returns Recent searches result
   */
  getRecentSearches(): Observable<string[]> {
    return from(this._searchResultsProvider.getRecentSearches());
  }

  /**
   * Builds search string from query parameters
   * @param paramMap Query parameter map
   * @returns Search string or null
   */
  buildSearchString(paramMap: any): string | null {
    return this._searchResultsProvider.buildSearchString(paramMap);
  }
}
