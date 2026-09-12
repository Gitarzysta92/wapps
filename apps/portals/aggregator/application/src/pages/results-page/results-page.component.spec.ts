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

async function settle(harness: RouterTestingHarness): Promise<void> {
  // Navigation activates the wrapper first; its signal inputs then start the resource.
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

describe('catalog page URL state', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([
          { path: 'categories', component: CategoryResultsPageComponent },
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
      '/categories?type=applications&search=Photo%20Snap'
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
    await harness.navigateByUrl('/categories?type=applications&search=does-not-exist');
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
      '/categories?type=applications&search=Photo%20Snap'
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
      '/categories?type=applications&search=a&pageSize=3'
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
    const sort = [...root().querySelectorAll('select')].find((select) =>
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
  it('applies the three application filter controls and resets pagination', async () => {
    const harness = await RouterTestingHarness.create(
      '/categories?type=applications&page=2&platform=web&device=mobile'
    );
    await settle(harness);
    const controls = [
      ...harness.routeNativeElement!.querySelectorAll('select'),
    ];
    const monetization = controls.find((select) =>
      select.parentElement?.textContent?.includes('Monetization')
    )!;
    expect(monetization).toBeDefined();
    monetization.value = 'freemium';
    monetization.dispatchEvent(new Event('change'));
    await settle(harness);
    expect(
      TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams
    ).toMatchObject({
      platform: 'web',
      device: 'mobile',
      monetization: 'freemium',
      page: '1',
    });
    expect(
      harness.routeNativeElement!.querySelector('.result-count')!.textContent
    ).toContain('1 result');
    expect(
      harness
        .routeNativeElement!.querySelector('.item-main')!
        .getAttribute('href')
    ).toBe('/apps/photo-snap');
  });
  it('shows URL-selected category, tag, and application facets in native controls on first render', async () => {
    const harness = await RouterTestingHarness.create('/categories?type=applications&category=photo-editing&tag=web-development&platform=0&device=1&monetization=1&sort=newest');
    await settle(harness);
    const selected = (label: string) => [...harness.routeNativeElement!.querySelectorAll('label')]
      .find(element => element.firstChild?.textContent?.trim() === label)?.querySelector('select')?.value;
    expect(selected('Category')).toBe('photo-editing');
    expect(selected('Tag')).toBe('Web Development');
    expect(selected('Platform')).toBe('web');
    expect(selected('Device')).toBe('mobile');
    expect(selected('Monetization')).toBe('freemium');
    expect(selected('Sort by')).toBe('newest');
    await harness.navigateByUrl('/categories?type=applications');
    await settle(harness);
    for (const label of ['Category', 'Tag', 'Platform', 'Device', 'Monetization']) expect(selected(label)).toBe('');
  });

  it('shows the route tag in the disabled native selector immediately', async () => {
    const harness = await RouterTestingHarness.create('/tags/web-development');
    await settle(harness);
    const tag = [...harness.routeNativeElement!.querySelectorAll('label')]
      .find(element => element.firstChild?.textContent?.trim() === 'Tag')!.querySelector('select')!;
    expect(tag.value).toBe('Web Development');
    expect(tag.disabled).toBe(true);
  });

  it.each([['/categories?type=applications', '20'], ['/categories?type=applications&pageSize=3', '3'], ['/categories?type=applications&pageSize=50', '50']])(
    'initializes the native page-size selector for %s', async (url, expected) => {
      const harness = await RouterTestingHarness.create(url);
      await settle(harness);
      const select = [...harness.routeNativeElement!.querySelectorAll('label')]
        .find(element => element.firstChild?.textContent?.trim() === 'Per page')!.querySelector('select')!;
      expect(select.value).toBe(expected);
    }
  );

});
