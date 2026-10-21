import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  HostListener,
  ViewChild,
  AfterViewInit,
  DestroyRef,
  Input,
  ElementRef,
} from '@angular/core';
import { TuiAppearance, TuiButton, TuiLoader } from '@taiga-ui/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  defer,
  distinctUntilChanged,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import {
  MULTISEARCH_ACCEPTED_QUERY_PARAM,
  MULTISEARCH_RESULTS_PROVIER,
  MULTISEARCH_STATE_PROVIDER,
} from './multi-search.constants';
import { SearchBarComponent } from '@ui/search-bar';
import {
  MultiSearchAvailability,
  MultiSearchPreviewState,
  MultiSearchRecentSearchesVM,
} from './multi-search.interface';

@Component({
  selector: 'multi-search',
  templateUrl: 'multi-search.component.html',
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
  @Input() ariaLabel = 'Search applications articles suites';
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    this.initialValue$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (this.searchBar.form.controls.search.value !== value) {
          this.searchBar.form.controls.search.setValue(value, {
            emitEvent: false,
          });
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
  private readonly _acceptedQueryParam = inject(
    MULTISEARCH_ACCEPTED_QUERY_PARAM
  );

  public isFocused = false;
  private readonly retries = new BehaviorSubject(0);

  private readonly searchPhrase$ = this.state.queryParamMap$.pipe(
    map((p) => (p[this._acceptedQueryParam] ?? '').trim()),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public readonly searchState$: Observable<MultiSearchPreviewState> =
    combineLatest([
      this.searchPhrase$,
      this.retries,
      this._searchResultsProvider.availability$ ??
        of<MultiSearchAvailability>({ status: 'ready' }),
    ]).pipe(
      switchMap(([phrase, , availability]) => {
        if (!phrase) return of({ status: 'idle' as const });
        if (availability.status !== 'ready')
          return of({
            status:
              availability.status === 'loading'
                ? ('loading' as const)
                : ('error' as const),
            message: availability.message,
          });
        return defer(() =>
          this._searchResultsProvider.search({
            [this._acceptedQueryParam]: phrase,
          })
        ).pipe(
          map((result) => {
            if (!result.ok) throw result.error;
            return { status: 'ready' as const, result: result.value };
          }),
          catchError((error: unknown) =>
            of({
              status: 'error' as const,
              message: error instanceof Error ? error.message : undefined,
            })
          ),
          startWith({ status: 'loading' as const })
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  public retrySearch(): void {
    // The retry replaces its button; keep focus on the stable input.
    this.element.nativeElement
      .querySelector<HTMLInputElement>('search-bar input')
      ?.focus();
    if (this._searchResultsProvider.retry?.()) return;
    this.retries.next(this.retries.value + 1);
  }

  public readonly searchPhraseProvided$ = this.searchPhrase$.pipe(
    map((phrase) => !!phrase)
  );
  public readonly initialValue$ = this.searchPhrase$;

  public readonly recentSearches$: Observable<MultiSearchRecentSearchesVM | null> =
    this._searchResultsProvider.getRecentSearches().pipe(
      map((r) => (r.ok ? r.value : null)),
      startWith(null as MultiSearchRecentSearchesVM | null)
    );

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
    if (!this.element.nativeElement.contains(event.relatedTarget as Node))
      this.closeDropdown();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // An internal action can remove its own target before the document listener runs.
    const searchContainer =
      event.composedPath().includes(this.element.nativeElement) ||
      this.element.nativeElement.contains(event.target as Node);

    if (!searchContainer && this.isFocused) {
      this.closeDropdown();
    }
  }
}
