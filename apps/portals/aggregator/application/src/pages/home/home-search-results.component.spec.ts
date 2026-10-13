import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { MultiSearchPreviewState } from '@portals/shared/features/multi-search';
import { HomeSearchResultsComponent } from './home-search-results.component';

describe('home preview states', () => {
  it('separates loading, failure and empty success and exposes retry', () => {
    TestBed.configureTestingModule({
      imports: [HomeSearchResultsComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(HomeSearchResultsComponent);
    const state = new BehaviorSubject<MultiSearchPreviewState>({
      status: 'idle',
    });
    fixture.componentRef.setInput('state$', state);
    const retry = jest.fn();
    fixture.componentInstance.retry.subscribe(retry);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No results');
    state.next({ status: 'loading' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Searching...');
    state.next({ status: 'error' });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent
    ).toContain('Search unavailable');
    expect(fixture.nativeElement.textContent).not.toContain('No results');
    fixture.nativeElement.querySelector('button').click();
    expect(retry).toHaveBeenCalledTimes(1);
    state.next({
      status: 'ready',
      result: {
        query: { search: 'missing' },
        itemsNumber: 0,
        groups: [],
        link: '/discover',
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No results');
  });
  it('explains filtered previews without calling them empty and preserves group search links', () => {
    TestBed.configureTestingModule({
      imports: [HomeSearchResultsComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(HomeSearchResultsComponent);
    const state = new BehaviorSubject<MultiSearchPreviewState>({
      status: 'ready',
      result: {
        itemsNumber: 42,
        link: '/discover',
        query: { search: 'work' },
        groups: [
          {
            id: 'suites',
            name: 'Suites',
            type: 'suites',
            icon: '@tui.box',
            link: '/discover',
            total: 42,
            hiddenCount: 3,
            entries: [],
          },
        ],
      },
    });
    fixture.componentRef.setInput('state$', state);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('No results');
    expect(fixture.nativeElement.textContent).toContain(
      '3 hidden in this preview'
    );
    expect(fixture.nativeElement.textContent).toContain('(42)');
    expect(
      fixture.nativeElement.querySelector('.group-header').getAttribute('href')
    ).toBe('/discover?search=work&type=suites');
    state.next({
      status: 'loading',
      message: 'Loading content preferences...',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Loading content preferences...'
    );
    expect(fixture.nativeElement.querySelector('.group-header')).toBeNull();
    state.next({
      status: 'error',
      message: 'Your content preferences could not be loaded.',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Your content preferences could not be loaded.'
    );
  });
});
