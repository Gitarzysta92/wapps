import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, HostListener } from "@angular/core";
import { TuiLoader } from "@taiga-ui/core";
import { first, map, Observable, of, startWith, switchMap, tap } from "rxjs";
import { SearchResultVM } from "@ui/search-results";
import { MULTISEARCH_ACCEPTED_QUERY_PARAM, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "./multi-search.constants";
import { SearchBarComponent } from "@ui/search-bar";
import { MultiSearchResultVM, MultiSearchRecentSearchesVM } from "./multi-search.interface";
import { DiscoverySearchResultType } from "@domains/discovery";

@Component({
  selector: "multi-search",
  templateUrl: "multi-search.component.html",
  styleUrl: 'multi-search.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    SearchBarComponent,
    TuiLoader,
  ],
})
export class MultiSearchComponent {

  public readonly state = inject(MULTISEARCH_STATE_PROVIDER);
  private readonly _searchResultsProvider = inject(MULTISEARCH_RESULTS_PROVIER);
  private readonly _acceptedQueryParam = inject(MULTISEARCH_ACCEPTED_QUERY_PARAM);

  public isFocused = false;
  public loadingResults = false;
  
  public readonly searchResults$: Observable<SearchResultVM> = this.state.queryParamMap$.pipe(
    tap(p => this.loadingResults = !!p[this._acceptedQueryParam]),
    map(p => ({ [this._acceptedQueryParam]: p[this._acceptedQueryParam] })),
    switchMap(p => p ? this._searchResultsProvider.search(p) : of({ ok: true as const, value: { itemsNumber: 0, groups: [], link: "", query: {} } })),
    map(r => r.ok ? this._mapToSearchResultVM(r.value) : { itemsNumber: 0, groups: [], link: "", query: {} } as SearchResultVM),
    startWith({ itemsNumber: 0, groups: [], link: "", query: {} } as SearchResultVM),
    tap(() => this.loadingResults = false)
  )

  private readonly _searchPharse = this.state.queryParamMap$.pipe(
    map(p => this._mapToSearchString(p)))

  public readonly searchPhraseProvided$ = this._searchPharse.pipe(map(p => !!p));

  public readonly initialValue$ = this._searchPharse.pipe(first());

  public readonly recentSearches$: Observable<MultiSearchRecentSearchesVM | null> = this._searchResultsProvider.getRecentSearches().pipe(
    map(r => r.ok ? r.value : null),
    startWith(null as MultiSearchRecentSearchesVM | null),
  )
  
  public onFocusChange(): void {
    this.isFocused = true;
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
      event.preventDefault();
      event.stopPropagation();
      this.closeDropdown();
    }
  }

  private _mapToSearchString(p: { [key: string]: string; }): string {
    return p[this._acceptedQueryParam] ?? '';
  }

  //TODO: code smell
  private _mapToSearchResultVM(result: MultiSearchResultVM): SearchResultVM {
    return {
      itemsNumber: result.itemsNumber,
      link: result.link,
      query: result.query,
      groups: result.groups.map((group, groupIndex) => {
        return {
          id: groupIndex,
          link: group.link,
          name: this._getGroupName(group.type),
          icon: this._getIcon(group.type),
          type: this._getTypeName(group.type),
          entries: group.entries.map((entry, entryIndex) => ({
            id: entryIndex,
            groupId: groupIndex,
            type: this._getTypeName(group.type),
            name: entry.name,
            description: '', // Description not available in DTO
            coverImageUrl: entry.coverImageUrl,
            link: entry.link,
            rating: 'rating' in entry ? entry.rating : undefined,
            authorName: 'authorName' in entry ? entry.authorName : undefined,
            authorAvatarUrl: 'authorAvatarUrl' in entry ? entry.authorAvatarUrl : undefined,
            tags: 'tags' in entry ? entry.tags : undefined as any,
          }))
        };
      })
    };
  }

  //TODO: code smell -> coupling
  private _getGroupName(type: DiscoverySearchResultType): string {
    switch (type) {
      case DiscoverySearchResultType.Application:
        return 'Applications';
      case DiscoverySearchResultType.Article:
        return 'Articles';
      case DiscoverySearchResultType.Suite:
        return 'Suites';
      default:
        return 'Unknown';
    }
  }

  //TODO: code smell -> coupling
  private _getTypeName(type: DiscoverySearchResultType): string {
    switch (type) {
      case DiscoverySearchResultType.Application:
        return 'Application';
      case DiscoverySearchResultType.Article:
        return 'Article';
      case DiscoverySearchResultType.Suite:
        return 'Suite';
      default:
        return 'Unknown';
    }
  }

  //TODO: code smell -> coupling
  private _getIcon(type: DiscoverySearchResultType): string {
    switch (type) {
      case DiscoverySearchResultType.Application:
        return '@tui.layout-grid';
      case DiscoverySearchResultType.Article:
        return '@tui.newspaper';
      case DiscoverySearchResultType.Suite:
        return '@tui.briefcase-business';
      default:
        return 'Unknown';
    }
  }

}