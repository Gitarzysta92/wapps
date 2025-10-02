import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, OnDestroy, Output, EventEmitter, input, output } from "@angular/core";
import { first, map, debounceTime, distinctUntilChanged, Subject, takeUntil, BehaviorSubject } from "rxjs";
import { SMART_SEARCH_RESULTS_PROVIDER, SMART_SEARCH_STATE_PROVIDER, SMART_SEARCH_CONFIG } from "../../application/smart-search.constants";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { TuiSearch } from "@taiga-ui/layout";
import { ChatInputComponent } from "@ui/chat-input";

@Component({
  selector: "smart-search-input-container",
  templateUrl: "smart-search-input-container.component.html",
  styleUrl: 'smart-search-input-container.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TuiSearch,
    ReactiveFormsModule,
    ChatInputComponent,
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

  public readonly initialValue = input<string | null>(null);
  public readonly onSearch = output<{ phrase: string }>();
  public readonly onFocus = output<boolean>();
  public readonly placeholder = input<string>('Search…');

  public readonly form = new FormGroup({
    search: new FormControl(this.initialValue())
  });

  private readonly _searchPhrase = this.state.queryParamMap$.pipe(
    map(p => this._searchResultsProvider.buildSearchString(p as Map<string, string>))
  );

  public readonly searchPhraseProvided$ = this._searchPhrase.pipe(map(p => !!p));
  public readonly initialValue$ = this._searchPhrase.pipe(first());

  ngOnInit(): void {
    this.form.controls.search.setValue(this.initialValue())
    this.form.valueChanges
      .pipe(debounceTime(300))
      .subscribe(v => this.onSearch.emit({ phrase: v.search as string }))
    
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

  // Event handlers for chat-input component
  public onChatSubmit(content: string): void {
    this.onSearch.emit({ phrase: content });
    this.search.emit(content);
  }

  public onChatContentChange(content: string): void {
    this._querySubject.next(content);
    this.queryChange.emit(content);
  }

  public onChatFocusChange(focused: boolean): void {
    this.onFocus.emit(focused);
    this.focus.emit(focused);
  }

}
