import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, HostListener, ViewChild, AfterViewInit, DestroyRef, ChangeDetectorRef, ElementRef } from "@angular/core";
import { TuiAppearance, TuiButton, TuiLoader } from "@taiga-ui/core";
import { catchError, distinctUntilChanged, map, Observable, of, shareReplay, startWith, switchMap, tap } from "rxjs";
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
    TuiAppearance,
    SearchBarComponent,
    TuiLoader,
    TuiButton,
  ],
})
export class MultiSearchComponent implements AfterViewInit {
  @ViewChild(SearchBarComponent) private searchBar!: SearchBarComponent;
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly element = inject(ElementRef<HTMLElement>);

  ngAfterViewInit(): void {
    this.initialValue$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => {
      if (this.searchBar.form.controls.search.value !== value) {
        this.searchBar.form.controls.search.setValue(value, { emitEvent: false });
      }
    });
  }

  public submitSearch(event: Event): void {
    event.preventDefault();
    const phrase = this.searchBar.form.controls.search.value?.trim() ?? '';
    if (!phrase) return;
    this.closeDropdown();
    this.state.submitSearch?.(phrase);
  }


  public readonly state = inject(MULTISEARCH_STATE_PROVIDER);
  private readonly _searchResultsProvider = inject(MULTISEARCH_RESULTS_PROVIER);
  private readonly _acceptedQueryParam = inject(MULTISEARCH_ACCEPTED_QUERY_PARAM);

  public isFocused = false;
  public loadingResults = false;
  
  private readonly searchPhrase$ = this.state.queryParamMap$.pipe(
    map(p => (p[this._acceptedQueryParam] ?? '').trim()),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public readonly searchResults$: Observable<SearchResultVM> = this.searchPhrase$.pipe(
    switchMap(phrase => {
      const empty: SearchResultVM = { itemsNumber: 0, groups: [], link: '', query: {} };
      this.loadingResults = !!phrase;
      this.changeDetector.markForCheck();
      return phrase ? this._searchResultsProvider.search({ [this._acceptedQueryParam]: phrase }).pipe(
        map(result => result.ok ? this._mapToSearchResultVM(result.value) : empty),
        catchError(() => of(empty)),
        tap(() => { this.loadingResults = false; this.changeDetector.markForCheck(); }),
        startWith(empty),
      ) : of(empty);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public readonly searchPhraseProvided$ = this.searchPhrase$.pipe(map(phrase => !!phrase));
  public readonly initialValue$ = this.searchPhrase$;

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

  @HostListener('keydown.escape')
  onEscape(): void {
    this.closeDropdown();
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    if (!this.element.nativeElement.contains(event.relatedTarget as Node)) this.closeDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const searchContainer = this.element.nativeElement.contains(event.target as Node);
    
    if (!searchContainer && this.isFocused) {
      this.closeDropdown();
    }
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
