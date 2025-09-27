import { InjectionToken } from "@angular/core";
import { ISmartSearchResultsProvider, ISmartSearchState } from "../smart-search.interface";

export const SMART_SEARCH_RESULTS_PROVIDER = new InjectionToken<ISmartSearchResultsProvider>('SMART_SEARCH_RESULTS_PROVIDER');
export const SMART_SEARCH_STATE_PROVIDER = new InjectionToken<ISmartSearchState>('SMART_SEARCH_STATE_PROVIDER');

export const SMART_SEARCH_CONFIG = {
  DEFAULT_LIMIT: 10,
  MAX_SUGGESTIONS: 5,
  DEBOUNCE_TIME: 300,
  MIN_QUERY_LENGTH: 2,
  CACHE_DURATION: 300000, // 5 minutes
} as const;
