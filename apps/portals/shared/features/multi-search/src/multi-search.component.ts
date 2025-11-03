import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, HostListener } from "@angular/core";
import { TuiLoader } from "@taiga-ui/core";
import { first, map, Observable, of, startWith, switchMap, tap } from "rxjs";
import { FullSearchRedirectComponent, SearchResultPreviewList, SearchResultListSkeleton, SearchResultVM } from "@ui/search-results";
import { MULTISEARCH_ACCEPTED_QUERY_PARAM, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from "./multi-search.constants";
import { SearchBarComponent } from "@ui/search-bar";
import { MultiSearchResultVM } from "./multi-search.interface";
import { EntityType } from "@domains/discovery";

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
  
  public readonly searchResults$: Observable<SearchResultVM> = this.state.queryParamMap$.pipe(
    tap(p => this.loadingResults = !!p),
    map(p => ({ [this._acceptedQueryParam]: p[this._acceptedQueryParam] })),
    switchMap(p => p ? this._searchResultsProvider.search(p) : of({ ok: true as const, value: { itemsNumber: 0, groups: [] } })),
    map(r => r.ok ? this._mapToSearchResultVM(r.value) : { itemsNumber: 0, groups: [] } as SearchResultVM),
    startWith({ itemsNumber: 0, groups: [] } as SearchResultVM),
    tap(() => this.loadingResults = false)
  )

  private readonly _searchPharse = this.state.queryParamMap$.pipe(
    map(p => this._mapToSearchString(p)))

  public readonly searchPhraseProvided$ = this._searchPharse.pipe(map(p => !!p));

  public readonly initialValue$ = this._searchPharse.pipe(first());

  public readonly recentSearches$: Observable<SearchResultVM> = this._searchResultsProvider.getRecentSearches().pipe(
    map(r => r.ok ? this._mapToSearchResultVM(r.value) : { itemsNumber: 0, groups: [] } as SearchResultVM),
    startWith({ itemsNumber: 0, groups: [] } as SearchResultVM),
  )

  public onFocusChange(focused: boolean): void {
    console.log('onFocusChange', focused);
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
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLElement;
    const searchContainer = target.closest('.search-container');
    
    if (!searchContainer && this.isFocused) {
      this.closeDropdown();
    }
  }

  private _mapToSearchString(p: { [key: string]: string; }): string {
    return p[this._acceptedQueryParam] ?? '';
  }

  private _mapToSearchResultVM(result: MultiSearchResultVM): SearchResultVM {
    return {
      itemsNumber: result.itemsNumber,
      groups: result.groups.map((group, groupIndex) => {
        const groupName = this._getGroupName(group.type);
        return {
          id: groupIndex,
          link: group.link,
          name: groupName,
          icon: this._getIcon(group.type),
          entries: group.entries.map((entry, entryIndex) => ({
            id: entryIndex,
            groupId: groupIndex,
            name: entry.name,
            description: '', // Description not available in DTO
            coverImageUrl: entry.coverImageUrl,
            link: entry.link
          }))
        };
      })
    };
  }

  //TODO: code smell
  private _getGroupName(type: EntityType): string {
    switch (type) {
      case EntityType.Application:
        return 'Applications';
      case EntityType.Article:
        return 'Articles';
      case EntityType.Suite:
        return 'Suites';
      default:
        return 'Unknown';
    }
  }

  private _getIcon(type: EntityType): string {
    switch (type) {
      case EntityType.Application:
        return '@tui.layout-grid';
      case EntityType.Article:
        return '@tui.newspaper';
      case EntityType.Suite:
        return '@tui.briefcase-business';
      default:
        return 'Unknown';
    }
  }

}