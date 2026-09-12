import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { MultiSearchComponent } from './multi-search.component';
import { MULTISEARCH_ACCEPTED_QUERY_PARAM, MULTISEARCH_RESULTS_PROVIER, MULTISEARCH_STATE_PROVIDER } from './multi-search.constants';
import { MultiSearchResultVM } from './multi-search.interface';
import { Result } from '@foundation/standard';
import { DiscoverySearchService } from '@portals/shared/features/search';

const result = (query: string): Result<MultiSearchResultVM> => ({
  ok: true, value: { itemsNumber: 1, groups: [], query: { search: query }, link: '/search' },
});

describe('multi-search interactions', () => {
  let params: BehaviorSubject<Record<string, string>>;
  let provider: { search: jest.Mock; getRecentSearches: jest.Mock };
  let state: { queryParamMap$: BehaviorSubject<Record<string, string>>; setQueryParams: jest.Mock; submitSearch: jest.Mock };
  let component: MultiSearchComponent;
  let form: FormGroup<{ search: FormControl<string | null> }>;

  beforeEach(() => {
    params = new BehaviorSubject<Record<string, string>>({});
    state = { queryParamMap$: params, setQueryParams: jest.fn(), submitSearch: jest.fn() };
    provider = { search: jest.fn(query => of(result(query.search))), getRecentSearches: jest.fn(() => of({ ok: true, value: { searches: [] } })) };
    TestBed.configureTestingModule({ imports: [MultiSearchComponent], providers: [
      { provide: MULTISEARCH_ACCEPTED_QUERY_PARAM, useValue: 'search' },
      { provide: MULTISEARCH_STATE_PROVIDER, useValue: state },
      { provide: MULTISEARCH_RESULTS_PROVIER, useValue: provider },
    ] });
    TestBed.overrideComponent(MultiSearchComponent, { set: { template: '', imports: [] } });
    component = TestBed.createComponent(MultiSearchComponent).componentInstance;
    form = new FormGroup({ search: new FormControl<string | null>('') });
    Object.assign(component, { searchBar: { form } });
  });

  it('submits the current input before its debounced URL update', () => {
    form.controls.search.setValue('  Quick Task  ');
    component.isFocused = true;
    const event = new Event('keydown', { cancelable: true });
    component.submitSearch(event);
    expect(state.submitSearch).toHaveBeenCalledWith('Quick Task');
    expect(event.defaultPrevented).toBe(true);
    expect(component.isFocused).toBe(false);
    form.controls.search.setValue(' ');
    component.submitSearch(event);
    expect(state.submitSearch).toHaveBeenCalledTimes(1);
  });

  it('does not search blanks and shares work between preview subscribers', () => {
    const a = component.searchResults$.subscribe();
    const b = component.searchResults$.subscribe();
    expect(provider.search).not.toHaveBeenCalled();
    params.next({ search: 'Photo Snap' });
    expect(provider.search).toHaveBeenCalledTimes(1);
    params.next({ search: 'Photo Snap', unrelated: 'changed' });
    expect(provider.search).toHaveBeenCalledTimes(1);
    params.next({ search: ' ' });
    expect(component.loadingResults).toBe(false);
    a.unsubscribe(); b.unsubscribe();
  });

  it('cancels stale results and recovers after provider errors', () => {
    const oldRequest = new Subject<Result<MultiSearchResultVM>>();
    const nextRequest = new Subject<Result<MultiSearchResultVM>>();
    provider.search.mockReturnValueOnce(oldRequest).mockReturnValueOnce(nextRequest);
    const queries: string[] = [];
    const subscription = component.searchResults$.subscribe(value => queries.push(value.query['search'] ?? ''));
    params.next({ search: 'old' });
    expect(component.loadingResults).toBe(true);
    params.next({ search: 'new' });
    oldRequest.next(result('old'));
    expect(queries).not.toContain('old');
    nextRequest.error(new Error('offline'));
    expect(component.loadingResults).toBe(false);
    params.next({ search: 'retry' });
    expect(queries).toContain('retry');
    subscription.unsubscribe();
  });

  it('syncs the visible input on back/forward changes without emitting another search', () => {
    const changed = jest.fn();
    form.valueChanges.subscribe(changed);
    component.ngAfterViewInit();
    params.next({ search: 'restored query' });
    expect(form.controls.search.value).toBe('restored query');
    expect(changed).not.toHaveBeenCalled();
  });

  it('closes on outside clicks without suppressing their default action', () => {
    component.isFocused = true;
    const event = new MouseEvent('click', { cancelable: true });
    document.body.dispatchEvent(event);
    component.onDocumentClick(event);
    expect(component.isFocused).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('persistent recent searches', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });
  it('restores history across service instances and publishes changes', () => {
    const service = TestBed.inject(DiscoverySearchService);
    const history: string[][] = [];
    service.recentSearches$.subscribe(value => history.push(value));
    service.remember(' Photo Snap ');
    service.remember('Quick Task');
    service.remember('photo snap');
    expect(history[history.length - 1]).toEqual(['photo snap', 'Quick Task']);
    const restored = TestBed.runInInjectionContext(() => new DiscoverySearchService());
    restored.recentSearches$.subscribe(value => expect(value).toEqual(['photo snap', 'Quick Task']));
  });
  it('survives malformed and unavailable storage', () => {
    localStorage.setItem('aggregator.recent-searches', '{broken');
    const service = TestBed.inject(DiscoverySearchService);
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => service.remember('Photo Snap')).not.toThrow();
    service.recentSearches$.subscribe(value => expect(value).toEqual(['Photo Snap']));
    write.mockRestore();
  });
});


describe('rendered search bar', () => {
  it('submits the input with Enter and the search button before debounce', fakeAsync(() => {
    const params = new BehaviorSubject<Record<string, string>>({});
    const submitSearch = jest.fn();
    TestBed.configureTestingModule({ imports: [MultiSearchComponent], providers: [
      { provide: MULTISEARCH_ACCEPTED_QUERY_PARAM, useValue: 'search' },
      { provide: MULTISEARCH_STATE_PROVIDER, useValue: { queryParamMap$: params, setQueryParams: jest.fn(), submitSearch } },
      { provide: MULTISEARCH_RESULTS_PROVIER, useValue: {
        search: jest.fn(() => of(result('Photo Snap'))),
        getRecentSearches: () => of({ ok: true, value: { searches: [] } }),
      } },
    ] });
    const fixture = TestBed.createComponent(MultiSearchComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search applications articles suites');
    input.value = 'Quick Task';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(submitSearch).toHaveBeenLastCalledWith('Quick Task');
    input.value = 'Photo Snap';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.nativeElement.querySelector('button[aria-label="Submit search"]').click();
    expect(submitSearch).toHaveBeenLastCalledWith('Photo Snap');
    tick(300);
    fixture.destroy();
  }));
});
