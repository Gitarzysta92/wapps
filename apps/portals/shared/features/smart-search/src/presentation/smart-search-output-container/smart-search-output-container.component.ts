import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, Input } from "@angular/core";
import { TuiLoader } from "@taiga-ui/core";
import { first, map, of, switchMap, tap, Subject, takeUntil, from } from "rxjs";
import { FullSearchRedirectComponent, SearchResultPreviewList, SearchResultListSkeleton } from "@ui/search-results";
import { SMART_SEARCH_STATE_PROVIDER, SMART_SEARCH_CONFIG, SMART_SEARCH_RESULTS_PROVIDER } from "../../application/smart-search.constants";
import { ISmartSearchResult } from "../../smart-search.interface";

@Component({
  selector: "smart-search-output-container",
  templateUrl: "smart-search-output-container.component.html",
  styleUrl: 'smart-search-output-container.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FullSearchRedirectComponent,
    SearchResultListSkeleton,
    SearchResultPreviewList,
    TuiLoader,
  ],
})
export class SmartSearchOutputContainerComponent implements OnInit, OnDestroy {
  public readonly state = inject(SMART_SEARCH_STATE_PROVIDER);
  private readonly _searchResultsProvider = inject(SMART_SEARCH_RESULTS_PROVIDER);
  private readonly _destroy$ = new Subject<void>();

  @Input() public isVisible: boolean = false;
  @Input() public suggestions: string[] = [];
  @Input() public query: string = '';

  public loadingResults: boolean = false;
  public loadingSuggestions: boolean = false;
  public smartRecommendations: any = null;
  public searchResult: any = null;

  private readonly _searchPhrase = this.state.queryParamMap$.pipe(
    map(p => this._searchResultsProvider.buildSearchString(p as Map<string, any>))
  );
  
  public readonly searchResults$ = this._searchPhrase.pipe(
    tap(p => this.loadingResults = !!p),
    switchMap(p => p ? from(this._searchResultsProvider.search(p as string)) : of({ itemsNumber: null, groups: [], suggestions: []} as any) ),
    tap((result) => {
      this.searchResult = result;
      this.loadingResults = false;
    })
  );

  public readonly searchPhraseProvided$ = this._searchPhrase.pipe(map(p => !!p));
  public readonly recentSearches: any = { groups: [] };

  ngOnInit(): void {
    // Load smart recommendations on component init
    this._loadSmartRecommendations();
    
    // Load suggestions when query changes
    if (this.query && this.query.length >= SMART_SEARCH_CONFIG.MIN_QUERY_LENGTH) {
      this._loadSuggestions(this.query);
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public onSuggestionSelect(suggestion: string): void {
    this.state.setQueryParams({ q: suggestion });
  }

  private _loadSuggestions(query: string): void {
    this.loadingSuggestions = true;
    from(this._searchResultsProvider.getSuggestions(query))
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (suggestions: string[]) => {
          this.suggestions = suggestions.slice(0, SMART_SEARCH_CONFIG.MAX_SUGGESTIONS);
          this.loadingSuggestions = false;
        },
        error: () => {
          this.loadingSuggestions = false;
        }
      });
  }

  private _loadSmartRecommendations(): void {
    from(this._searchResultsProvider.getSmartRecommendations())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (recommendations: any[]) => {
          this.smartRecommendations = recommendations;
        },
        error: () => {
          // Handle error silently for recommendations
        }
      });
  }
}
