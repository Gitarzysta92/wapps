import { InjectionToken } from "@angular/core";
import { IMultiSearchResultsProvider, IMultiSearchState } from "./multi-search.interface";

export const MULTISEARCH_RESULTS_PROVIER = new InjectionToken<IMultiSearchResultsProvider>('MULTISEARCH_RESULTS_PROVIER');
export const MULTISEARCH_STATE_PROVIDER = new InjectionToken<IMultiSearchState>('MULTISEARCH_STATE_PROVIDER');