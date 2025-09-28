import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, Output, EventEmitter } from "@angular/core";
import { first, map, debounceTime, distinctUntilChanged, Subject, takeUntil, BehaviorSubject } from "rxjs";
import { SMART_SEARCH_RESULTS_PROVIDER, SMART_SEARCH_STATE_PROVIDER, SMART_SEARCH_CONFIG } from "../../application/smart-search.constants";
import { SearchBarComponent } from "@ui/search-bar";

@Component({
  selector: "smart-search-input-container",
  templateUrl: "smart-search-input-container.component.html",
  styleUrl: 'smart-search-input-container.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    SearchBarComponent,
  ],
})
export class SmartSearchInputContainerComponent implements OnInit, OnDestroy {
  public readonly state = inject(SMART_SEARCH_STATE_PROVIDER);
  private readonly _searchResultsProvider = inject(SMART_SEARCH_RESULTS_PROVIDER);
  private readonly _destroy$ = new Subject<void>();
  private readonly _querySubject = new BehaviorSubject<string>('');

  @Output() public queryChange = new EventEmitter<string>();
  @Output() public search = new EventEmitter<string>();
  @Output() public focus = new EventEmitter<boolean>();
  @Output() public suggestionsRequest = new EventEmitter<string>();

  public isFocused = false;

  private readonly _searchPhrase = this.state.queryParamMap$.pipe(
    map(p => this._searchResultsProvider.buildSearchString(p as Map<string, any>))
  );

  public readonly searchPhraseProvided$ = this._searchPhrase.pipe(map(p => !!p));
  public readonly initialValue$ = this._searchPhrase.pipe(first());

  ngOnInit(): void {
    // Setup query debouncing for suggestions
    this._querySubject.pipe(
      debounceTime(SMART_SEARCH_CONFIG.DEBOUNCE_TIME),
      distinctUntilChanged(),
      takeUntil(this._destroy$)
    ).subscribe(query => {
      if (query.length >= SMART_SEARCH_CONFIG.MIN_QUERY_LENGTH) {
        this.suggestionsRequest.emit(query);
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public onQueryChange(event: any): void {
    const query = typeof event === 'string' ? event : event?.target?.value || '';
    this._querySubject.next(query);
    this.queryChange.emit(query);
  }

  public onSearch(event: any): void {
    const query = typeof event === 'string' ? event : event?.phrase || event?.target?.value || '';
    this.state.setQueryParams({ q: query });
    this.search.emit(query);
  }

  public onFocus(event: any): void {
    const focused = typeof event === 'boolean' ? event : event?.target?.focused || false;
    this.isFocused = focused;
    this.focus.emit(focused);
  }

}
