import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, HostListener } from "@angular/core";
import { TuiLoader } from "@taiga-ui/core";
import { first, map, of, startWith, switchMap, tap } from "rxjs";
import { FullSearchRedirectComponent, SearchResultPreviewList, SearchResultListSkeleton } from "@ui/search-results";
import { MULTISEARCH_ACCEPTED_QUERY_PARAM, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "./multi-search.constants";
import { SearchBarComponent } from "@ui/search-bar";

@Component({
  selector: "multi-search",
  templateUrl: "multi-search.component.html",
  styleUrl: 'multi-search.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    SearchBarComponent,
    FullSearchRedirectComponent,
    SearchResultListSkeleton,
    SearchResultPreviewList,
    TuiLoader,
  ],
})
export class MultiSearchComponent {

  public readonly state = inject(MULTISEARCH_STATE_PROVIDER);
  private readonly _searchResultsProvider = inject(MULTISEARCH_RESULTS_PROVIER);
  private readonly _acceptedQueryParam = inject(MULTISEARCH_ACCEPTED_QUERY_PARAM);

  public isFocused = false;
  public loadingResults = false;
  
  public readonly searchResults$ = this.state.queryParamMap$.pipe(
    tap(p => this.loadingResults = !!p),
    map(p => ({ [this._acceptedQueryParam]: p[this._acceptedQueryParam] })),
    switchMap(p => p ? this._searchResultsProvider.search(p) : of({ ok: true as const, value: { itemsNumber: 0, groups: [] } })),
    map(r => r.ok ? r.value : { itemsNumber: 0, groups: [] }),
    startWith({ itemsNumber: 0, groups: [] }),
    tap(() => this.loadingResults = false)
  )

  private readonly _searchPharse = this.state.queryParamMap$.pipe(
    map(p => this._mapToSearchString(p)))

  public readonly searchPhraseProvided$ = this._searchPharse.pipe(map(p => !!p));

  public readonly initialValue$ = this._searchPharse.pipe(first());

  public readonly recentSearches$ = this._searchResultsProvider.getRecentSearches().pipe(
    map(r => r.ok ? r.value : { itemsNumber: 0, groups: [] }),
    startWith({ itemsNumber: 0, groups: [] }),
  )

  public onFocusChange(focused: boolean): void {
    this.isFocused = focused;
  }

  public closeDropdown(): void {
    this.isFocused = false;
  }

  public onSearchChange(search: string | null): void {
    this.state.setQueryParams({ [this._acceptedQueryParam]: search });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const searchContainer = target.closest('.search-container');
    
    if (!searchContainer && this.isFocused) {
      this.closeDropdown();
    }
  }

  private _mapToSearchString(p: { [key: string]: string; }): string {
    return p[this._acceptedQueryParam] ?? '';
  }

}