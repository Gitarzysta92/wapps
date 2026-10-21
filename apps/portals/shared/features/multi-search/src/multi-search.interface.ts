import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { SearchResultVM } from '@ui/search-results';

export interface IMultiSearchState {
  queryParamMap$: Observable<Record<string, string>>;
  submitSearch?(phrase: string): void;
  setQueryParams(params: Record<string, string | null>): void;
}

export interface IMultiSearchResultsProvider {
  readonly availability$?: Observable<MultiSearchAvailability>;
  /** True when retrying availability will trigger a new search itself. */
  retry?(): boolean;
  getRecentSearches(): Observable<Result<MultiSearchRecentSearchesVM>>;
  search(
    params: Record<string, string>
  ): Observable<Result<MultiSearchResultVM>>;
}

export type MultiSearchResultVM = Omit<SearchResultVM, 'groups'> & {
  groups: (Omit<SearchResultVM['groups'][number], 'entries'> & {
    entries: (SearchResultVM['groups'][number]['entries'][number] & {
      articleCover?: { articleId: string; imageId: string; alt: string };
    })[];
    total?: number;
    hiddenCount?: number;
  })[];
};

export interface MultiSearchAvailability {
  status: 'ready' | 'loading' | 'unavailable';
  message?: string;
}

export type MultiSearchPreviewState =
  | { status: 'idle' | 'loading'; message?: string }
  | { status: 'ready'; result: MultiSearchResultVM }
  | { status: 'error'; message?: string };

export interface MultiSearchRecentSearchesVM {
  searches: { link: string; name: string; query: Record<string, string> }[];
}
