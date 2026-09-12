import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterLink, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SearchBarComponent } from '@ui/search-bar';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { FiltersMultiselectComponent } from '@ui/filters';
import { TuiButton } from '@taiga-ui/core';
import { TuiDropdownOpen, TuiDropdownDirective, TuiDropdownOptionsDirective } from '@taiga-ui/core/directives/dropdown';
import { ParamMapToFilterVmListMapper } from '@portals/shared/features/filtering';
import { DiscoverPageComponent } from './discover-page.component';
import { DISCOVER_REDIRECT_ROUTES } from './discover-redirect.routes';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { GlobalStateService } from '../../state/global-state.service';

describe('Discover search', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      GlobalStateService, ParamMapToFilterVmListMapper,
      provideRouter([
        { path: 'discover', component: DiscoverPageComponent },
        ...DISCOVER_REDIRECT_ROUTES,
      ]),
    ] });
    // Exercise real search/filter controls and routing without unrelated card internals.
    TestBed.overrideComponent(DiscoverPageComponent, { set: {
      imports: [CommonModule, RouterLink, SearchBarComponent, FiltersBarComponent,
        PageHeaderComponent, PageTitleComponent, FiltersMultiselectComponent,
        TuiButton, TuiDropdownOpen, TuiDropdownDirective, TuiDropdownOptionsDirective],
      schemas: [NO_ERRORS_SCHEMA],
    } });
  });

  it('uses one search/filter interface for all three content types', async () => {
    const harness = await RouterTestingHarness.create('/discover');
    expect(harness.routeDebugElement!.query(By.directive(FiltersBarComponent))).toBeTruthy();
    expect(harness.routeNativeElement!.querySelector('results-page')).toBeNull();
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups).toHaveLength(3);
    const input = harness.routeDebugElement!.query(By.directive(SearchBarComponent)).componentInstance as SearchBarComponent;
    input.form.controls.search.setValue('photo', { emitEvent: false });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('search-bar button')!.click();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover?search=photo');
    const result = TestBed.inject(GlobalStateService).searchResultsData$.value;
    expect(result.query.search).toBe('photo');
    expect(result.groups.find(group => group.type === 'application')!.entries.map(entry => entry.name)).toEqual(['Photo Snap']);
  });

  it('applies, restores and removes filters on Discover', async () => {
    const harness = await RouterTestingHarness.create('/discover?search=photo');
    const filters = harness.routeDebugElement!.query(By.directive(FiltersBarComponent)).componentInstance as FiltersBarComponent;
    expect(filters.getSelectedOptionsWithFlag('search', [{ id: 0, name: 'photo', value: 'photo' }]))
      .toEqual([{ id: 0, name: 'photo', value: 'photo', isSelected: true }]);
    filters.onFilterSelectionChange('platform', [{ id: 2, name: 'Desktop', value: 'desktop' }]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover?search=photo&platform=desktop');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.itemsNumber).toBe(0);
    filters.onDeactivateFilter('search');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover?platform=desktop');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups[0].entries.map(entry => entry.name)).toEqual(['Speedy VPN']);
    filters.onDeactivateFilter('platform');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups).toHaveLength(3);
  });

  it('lets a type-scoped search return to all content types', async () => {
    const harness = await RouterTestingHarness.create('/discover?type=article');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups.map(group => group.type)).toEqual(['article']);
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a')!.click();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups).toHaveLength(3);
  });

  it.each([
    ['/search?search=photo&platform=web&platform=mobile#application', '/discover?search=photo&platform=web&platform=mobile#application'],
    ['/search/page/2?search=photo&type=article', '/discover?search=photo&type=article&page=2'],
    ['/app?search=photo', '/discover?type=application&search=photo'],
    ['/apps?tags=AI', '/discover?type=application&tags=AI'],
    ['/app/photo-editing/page/2?platform=web', '/discover?type=application&platform=web&category=photo-editing&page=2'],
    ['/discover/page/2?search=photo', '/discover?search=photo&page=2'],
    ['/discover/productivity/page/2', '/discover?category=productivity&page=2'],
  ])('redirects %s without losing its filters', async (url, expected) => {
    await RouterTestingHarness.create(url);
    expect(TestBed.inject(Router).url).toBe(expected);
  });

  it('restores legacy search input and keeps subsequent edits on Discover', async () => {
    const harness = await RouterTestingHarness.create('/search?q=photo');
    const input = harness.routeDebugElement!.query(By.directive(SearchBarComponent)).componentInstance as SearchBarComponent;
    expect(input.form.controls.search.value).toBe('photo');
    input.form.controls.search.setValue('', { emitEvent: false });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('search-bar button')!.click();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups).toHaveLength(3);
  });

  it('shows and clears filters from legacy query aliases', async () => {
    const harness = await RouterTestingHarness.create('/search?q=photo&tags=web-development');
    expect(harness.routeNativeElement!.textContent).toContain('Search:');
    expect(harness.routeNativeElement!.textContent).toContain('Tag:');
    const filters = harness.routeDebugElement!.query(By.directive(FiltersBarComponent)).componentInstance as FiltersBarComponent;
    filters.onDeactivateFilter('search');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover?tags=web-development');
    filters.onDeactivateFilter('tag');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/discover');
    expect(TestBed.inject(GlobalStateService).searchResultsData$.value.groups).toHaveLength(3);
  });
});
