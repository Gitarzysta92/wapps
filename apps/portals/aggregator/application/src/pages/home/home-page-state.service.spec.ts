import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { DiscoverySearchService } from '@portals/shared/features/search';
import { HomePageStateService } from './home-page-state.service';

describe('Explore search draft', () => {
  function setup() {
    const params = new BehaviorSubject(convertToParamMap({ search: 'photo' }));
    const navigate = jest.fn();
    const remember = jest.fn();
    TestBed.configureTestingModule({ providers: [
      HomePageStateService,
      { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      { provide: Router, useValue: { navigate } },
      { provide: DiscoverySearchService, useValue: { remember } },
    ] });
    const state = TestBed.inject(HomePageStateService);
    const queries: Record<string, string>[] = [];
    state.queryParamMap$.subscribe(value => queries.push(value));
    return { state, params, queries, navigate, remember };
  }

  it('initializes from the URL and updates suggestions without triggering router scroll restoration', () => {
    const { state, queries, navigate } = setup();
    expect(queries).toEqual([{ search: 'photo' }]);
    state.setQueryParams({ search: '  quick task ' });
    state.setQueryParams({ search: null });
    expect(queries).toEqual([{ search: 'photo' }, { search: 'quick task' }, { search: '' }]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores the query when browser navigation changes the route', () => {
    const { state, params, queries } = setup();
    state.setQueryParams({ search: 'draft' });
    params.next(convertToParamMap({ search: 'restored' }));
    expect(queries[queries.length - 1]).toEqual({ search: 'restored' });
  });

  it('remembers and navigates with the submitted query, ignoring blank submissions', () => {
    const { state, navigate, remember } = setup();
    state.submitSearch('  quick task  ');
    state.submitSearch(' ');
    expect(remember).toHaveBeenCalledWith('quick task');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/discover'], { queryParams: { search: 'quick task' } });
  });
});
