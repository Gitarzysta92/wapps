import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, HostListener } from "@angular/core";
import { TuiLoader } from "@taiga-ui/core";
import { first, map, of, switchMap, tap } from "rxjs";
import { FullSearchRedirectComponent, SearchResultList, SearchResultListSkeleton } from "@ui/search-results";
import { MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "./multi-search.constants";
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
    SearchResultList,
    TuiLoader,
  ],
})
export class MultiSearchComponent {
  public readonly state = inject(MULTISEARCH_STATE_PROVIDER);
  private readonly _searchResultsProvider = inject(MULTISEARCH_RESULTS_PROVIER);

  public isFocused = false;
  public loadingResults = false;

  private readonly _searchPharse = this.state.queryParamMap$.pipe(
    map(p => this._searchResultsProvider.buildSearchString(p)))
  
  public readonly searchResults$ = this._searchPharse.pipe(
    tap(p => this.loadingResults = !!p),
    switchMap(p => p ? this._searchResultsProvider.search(p) : of({ itemsNumber: null, groups: []}) ),
    tap(() => this.loadingResults = false)
  )

  public readonly searchPhraseProvided$ = this._searchPharse.pipe(map(p => !!p));

  public readonly initialValue$ = this._searchPharse.pipe(first());

  public readonly recentSearches = this._searchResultsProvider.getRecentSearches()

  public onFocusChange(focused: boolean): void {
    this.isFocused = focused;
  }

  public closeDropdown(): void {
    this.isFocused = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const searchContainer = target.closest('.search-container');
    
    if (!searchContainer && this.isFocused) {
      this.closeDropdown();
    }
  }

}