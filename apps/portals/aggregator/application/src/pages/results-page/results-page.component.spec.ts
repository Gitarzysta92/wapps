import { firstValueFrom } from 'rxjs';
import { FiltersBarComponent } from '../../partials/filters-bar/src';
import { Component, signal } from '@angular/core';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { TuiDropdowns, TuiDropdownDirective } from '@taiga-ui/core/directives/dropdown';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ArticlesPageComponent } from '../articles/articles.component';
import { TagResultsPageComponent } from '../tag-results-page/tag-results-page.component';
import { CategoryResultsPageComponent } from '../category-results-page/category-results-page.component';
import { SuitesPageComponent } from '../suites/suites.component';
import { EntryDetailsDataService } from '../entry-details-page/entry-details-data.service';
import { ResultsPageComponent } from './results-page.component';
import { By } from '@angular/platform-browser';

@Component({ standalone: true, imports: [ResultsPageComponent], template: '<results-page kind="all" browse="category" />' })
class CatalogTestPageComponent {}

async function settle(harness: RouterTestingHarness): Promise<void> {
  // Navigation activates the wrapper first; its signal inputs then start the resource.
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}


async function openPanel(harness: RouterTestingHarness, name = 'Display options'): Promise<HTMLElement> {
  const trigger = harness.routeDebugElement!
    .queryAll(By.directive(TuiDropdownDirective))
    .find(element => element.nativeElement.textContent.trim() === name)!;
  const dropdown = trigger.injector.get(TuiDropdownDirective);
  if (!dropdown.ref()) {
    TestBed.createComponent(TuiDropdowns).detectChanges();
    document.body.appendChild(harness.fixture.nativeElement);
    // Supply layout and hit-testing absent from jsdom for Taiga's real portal.
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => trigger.nativeElement });
    jest.spyOn(trigger.nativeElement, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 160, bottom: 32, width: 160, height: 32,
      toJSON: () => ({}),
    });
    jest.spyOn(dropdown, 'position', 'get').mockReturnValue('absolute');
    dropdown.toggle(true);
    await settle(harness);
  }
  dropdown.ref()!.changeDetectorRef.detectChanges();
  return document.querySelector<HTMLElement>(name === 'Manage filters' ? '.filter-management-panel' : '.catalog-display-options')!;
}

describe('catalog page URL state', () => {
  afterEach(() => Reflect.deleteProperty(document, 'elementFromPoint'));
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        { provide: TUI_DARK_MODE, useValue: signal(false) },
        provideNoopAnimations(),
        provideRouter([
          { path: 'catalog', component: CatalogTestPageComponent },
          { path: 'categories', component: CategoryResultsPageComponent },
          { path: 'tags', component: TagResultsPageComponent },
          { path: 'articles', component: ArticlesPageComponent },
          { path: 'suites', component: SuitesPageComponent },
          { path: 'tags/:tagSlug', component: TagResultsPageComponent },
          {
            path: 'categories/:categorySlug',
            component: CategoryResultsPageComponent,
          },
        ]),
      ],
    })
  );

  it('renders application filtering from the URL and responds to query navigation', async () => {
    const harness = await RouterTestingHarness.create(
      '/catalog?type=applications&search=Photo%20Snap'
    );
    await settle(harness);
    expect(
      harness.routeNativeElement?.querySelector('.result-count')?.textContent
    ).toContain('1 result');
    expect(
      harness.routeNativeElement
        ?.querySelector('.item-main')
        ?.getAttribute('href')
    ).toBe('/apps/photo-snap');
    await harness.navigateByUrl('/catalog?type=applications&search=does-not-exist');
    await settle(harness);
    expect(harness.routeNativeElement?.textContent).toContain(
      'No results found'
    );
    expect(
      harness.routeNativeElement?.querySelectorAll('.item-card').length
    ).toBe(0);
  });

  it('renders the full article catalog with article detail links', async () => {
    const harness = await RouterTestingHarness.create('/articles');
    await settle(harness);
    const links = [
      ...harness.routeNativeElement!.querySelectorAll('.item-main'),
    ];
    expect(links.length).toBeGreaterThan(0);
    expect(
      links.every((link) => link.getAttribute('href')?.startsWith('/articles/'))
    ).toBe(true);
    expect(
      harness.routeNativeElement?.querySelector('h1')?.textContent
    ).toContain('Articles');
  });

  it('combines a route tag with URL type and search filters', async () => {
    const harness = await RouterTestingHarness.create(
      '/tags/productivity?type=applications&search=Quick'
    );
    await settle(harness);
    expect(
      harness.routeNativeElement?.querySelector('.result-count')?.textContent
    ).toContain('1 result');
    expect(
      harness.routeNativeElement
        ?.querySelector('.item-main')
        ?.getAttribute('href')
    ).toBe('/apps/quick-task');
  });
  it('encodes category segments once and uses semantic tag slugs', async () => {
    const harness = await RouterTestingHarness.create(
      '/catalog?type=applications&search=Photo%20Snap'
    );
    await settle(harness);
    const links = [
      ...harness.routeNativeElement!.querySelectorAll('.item-facets a'),
    ];
    const tag = links.find((link) =>
      link.textContent?.includes('Web Development')
    )!;
    expect(tag.getAttribute('href')).toBe('/tags/web-development');
    const page = harness.routeDebugElement!.query(
      By.directive(ResultsPageComponent)
    ).componentInstance as ResultsPageComponent;
    const router = TestBed.inject(Router);
    expect(
      router.serializeUrl(
        router.createUrlTree(page.facetPath('category', 'Design Tools'))
      )
    ).toBe('/categories/Design%20Tools');
    (tag as HTMLAnchorElement).click();
    await settle(harness);
    expect(router.url).toBe('/tags/web-development');
    expect(harness.routeNativeElement!.textContent).toContain(
      'Web Development'
    );
    expect(
      harness.routeNativeElement!.querySelectorAll('.item-card').length
    ).toBeGreaterThan(0);
  });

  it('sorts and paginates through controls while preserving search in the URL', async () => {
    const harness = await RouterTestingHarness.create(
      '/catalog?type=applications&search=a&pageSize=3'
    );
    await settle(harness);
    const root = () => harness.routeNativeElement!;
    const names = () =>
      [...root().querySelectorAll('.item-main h2')].map((node) =>
        node.textContent!.trim()
      );
    const first = names();
    const next = [...root().querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Next'
    )!;
    expect(next.disabled).toBe(false);
    next.click();
    await settle(harness);
    const router = TestBed.inject(Router);
    expect(router.parseUrl(router.url).queryParams).toMatchObject({
      search: 'a',
      pageSize: '3',
      page: '2',
    });
    expect(names().every((name) => !first.includes(name))).toBe(true);
    const filterPanel = await openPanel(harness);
    const sort = [...filterPanel.querySelectorAll('select')].find((select) =>
      [...select.options].some((option) => option.value === 'name-desc')
    )!;
    sort.value = 'name-desc';
    sort.dispatchEvent(new Event('change'));
    await settle(harness);
    expect(router.parseUrl(router.url).queryParams).toMatchObject({
      search: 'a',
      pageSize: '3',
      page: '1',
      sort: 'name-desc',
    });
    expect(names()).toEqual([...names()].sort((a, b) => b.localeCompare(a)));
    const previous = [...root().querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Previous'
    )!;
    expect(previous.disabled).toBe(true);
  });
  it('lists a newly saved suite with its title, app count, filters, and detail link', async () => {
    const storageKey = 'wapps.suite-drafts.v1';
    const previous = localStorage.getItem(storageKey);
    try {
      const suite = TestBed.inject(EntryDetailsDataService).createSuite(
        'Catalog regression collection',
        'Saved tools for listing validation',
        ['photo-snap', 'quick-task']
      );
      const harness = await RouterTestingHarness.create(
        '/suites?search=Catalog%20regression&category=personal-collection'
      );
      await settle(harness);
      const card = harness.routeNativeElement!.querySelector('.item-main')!;
      expect(card.textContent).toContain('Catalog regression collection');
      expect(card.textContent).toContain('Saved tools for listing validation');
      expect(card.textContent).toContain('2 applications');
      expect(card.getAttribute('href')).toBe('/suites/' + suite.slug);
      expect(
        harness.routeNativeElement!.querySelector('.result-count')!.textContent
      ).toContain('1 result');
    } finally {
      if (previous === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, previous);
    }
  });
  const sharedFilters = (harness: RouterTestingHarness): FiltersBarComponent =>
    harness.routeDebugElement!.query(By.directive(FiltersBarComponent)).componentInstance;

  it.each(['/categories/photo-editing', '/tags/web-development'])('uses the shared filter picker on %s', async path => {
    const harness = await RouterTestingHarness.create(path);
    await settle(harness);
    const panel = await openPanel(harness, 'Manage filters');
    expect(panel.querySelector('filters-multiselect')).toBeTruthy();
    expect(panel.querySelector('select')).toBeNull();
    expect(panel.textContent).toContain('Category');
    expect(panel.textContent).toContain('Content type');
  });

  it('applies application facets with the shared controls and resets pagination', async () => {
    const harness = await RouterTestingHarness.create('/catalog?type=applications&page=2&platform=web&device=mobile');
    await settle(harness);
    sharedFilters(harness).onFilterSelectionChange('monetization', [{ id: 1, name: 'Freemium', value: 'freemium' }]);
    await settle(harness);
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toMatchObject({
      platform: 'web', device: 'mobile', monetization: 'freemium', page: '1',
    });
    expect(harness.routeNativeElement!.querySelector('.result-count')!.textContent).toContain('1 result');
    expect(harness.routeNativeElement!.querySelector('.item-main')!.getAttribute('href')).toBe('/apps/photo-snap');
  });

  it('restores URL slugs and legacy facet IDs as named chips on first render', async () => {
    const harness = await RouterTestingHarness.create('/catalog?type=applications&category=photo-editing&tag=web-development&platform=0&device=1&monetization=1&sort=newest');
    await settle(harness);
    const filters = await firstValueFrom(sharedFilters(harness).filters$);
    const value = (key: string) => filters.find(filter => filter.key === key)!.options[0];
    expect(value('category')).toMatchObject({ value: 'photo-editing', name: 'Photo editing' });
    expect(value('tag')).toMatchObject({ value: 'Web Development', name: 'Web Development' });
    expect(value('platform')).toMatchObject({ value: 'web', name: 'Web' });
    expect(value('device')).toMatchObject({ value: 'mobile', name: 'Mobile' });
    expect(value('monetization')).toMatchObject({ value: 'freemium', name: 'Freemium' });
    expect(harness.routeNativeElement!.querySelectorAll('selected-filter-chip')).toHaveLength(6);
    await harness.navigateByUrl('/categories'); await settle(harness);
    expect(harness.routeNativeElement!.querySelectorAll('selected-filter-chip')).toHaveLength(0);
  });

  it.each([
    ['/tags/web-development', 'tag', '/tags'],
    ['/categories/photo-editing', 'category', '/categories'],
  ])('removes the path facet from %s while preserving display settings', async (path, key, destination) => {
    const harness = await RouterTestingHarness.create(path + '?sort=name-desc&pageSize=3&view=list');
    await settle(harness);
    expect((await firstValueFrom(sharedFilters(harness).filters$)).some(filter => filter.key === key)).toBe(true);
    sharedFilters(harness).onDeactivateFilter(key); await settle(harness);
    const router = TestBed.inject(Router);
    expect(router.url.split('?')[0]).toBe(destination);
    expect(router.parseUrl(router.url).queryParams).toMatchObject({ sort: 'name-desc', pageSize: '3', view: 'list' });
    expect(harness.routeNativeElement!.querySelectorAll('selected-filter-chip')).toHaveLength(0);
    expect(harness.routeNativeElement!.querySelectorAll('.directory-card').length).toBeGreaterThan(0);
  });

  it('combines multi-category choices and preserves them when changing another filter', async () => {
    const harness = await RouterTestingHarness.create('/catalog?type=applications&category=photo-editing&category=project-management-software&view=list&pageSize=3');
    await settle(harness);
    const page = harness.routeDebugElement!.query(By.directive(ResultsPageComponent)).componentInstance as ResultsPageComponent;
    expect(page.query().category).toBe('photo-editing,project-management-software');
    expect(page.result.value()!.items.map(item => item.slug)).toEqual(expect.arrayContaining(['photo-snap', 'quick-task']));
    sharedFilters(harness).onFilterSelectionChange('platform', [{ id: 0, name: 'Web', value: 'web' }]);
    await settle(harness);
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toMatchObject({
      category: ['photo-editing', 'project-management-software'], platform: 'web', view: 'list', pageSize: '3',
    });
  });

  it('clears search and tag aliases without leaving hidden filters behind', async () => {
    const harness = await RouterTestingHarness.create('/tags/web-development?q=photo&tags=AI');
    await settle(harness);
    sharedFilters(harness).onDeactivateFilter('search'); await settle(harness);
    expect(TestBed.inject(Router).url).not.toContain('q=');
    sharedFilters(harness).onDeactivateFilter('tag'); await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/tags?page=1');
  });

  it('clear filters removes path constraints but retains display preferences', async () => {
    const harness = await RouterTestingHarness.create('/tags/web-development?type=applications&q=photo&page=2&sort=name-desc&pageSize=3&view=list');
    await settle(harness);
    const clear = [...harness.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Clear filters')!;
    clear.click(); await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/tags?sort=name-desc&pageSize=3&view=list');
    expect(harness.routeNativeElement!.querySelectorAll('selected-filter-chip')).toHaveLength(0);
  });

  it.each([['/catalog?type=applications', '20'], ['/catalog?type=applications&pageSize=3', '3'], ['/catalog?type=applications&pageSize=50', '50']])(
    'initializes the native page-size selector for %s', async (url, expected) => {
      const harness = await RouterTestingHarness.create(url);
      await settle(harness);
      const filterPanel = await openPanel(harness);
      const select = [...filterPanel.querySelectorAll('label')]
        .find(element => element.firstChild?.textContent?.trim() === 'Per page')!.querySelector('select')!;
      expect(select.value).toBe(expected);
    }
  );

});
