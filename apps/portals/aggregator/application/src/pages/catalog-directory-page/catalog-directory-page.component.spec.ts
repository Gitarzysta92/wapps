import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { SearchBarComponent } from '@ui/search-bar';
import { CATEGORIES, TAGS } from '@portals/shared/data';
import { catalogDirectory, CATALOG_ENTRIES, normalizeCatalogFacet, searchCatalogDirectory } from '@portals/shared/features/listing';
import { CategoryResultsPageComponent } from '../category-results-page/category-results-page.component';
import { TagResultsPageComponent } from '../tag-results-page/tag-results-page.component';
import { CatalogDirectoryPageComponent } from './catalog-directory-page.component';

async function settle(harness: RouterTestingHarness) {
  harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
  await harness.fixture.whenStable(); harness.detectChanges();
}

describe('category and tag directories', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    { provide: TUI_DARK_MODE, useValue: signal(false) }, provideNoopAnimations(),
    provideRouter([
      { path: 'categories', component: CategoryResultsPageComponent },
      { path: 'tags', component: TagResultsPageComponent },
      { path: 'categories/:categorySlug', component: CategoryResultsPageComponent },
      { path: 'tags/:tagSlug', component: TagResultsPageComponent },
    ]),
  ] }));

  it.each(['/categories', '/tags'])('shows directory cards with only text search and view controls on %s', async path => {
    const harness = await RouterTestingHarness.create(path + '?platform=desktop&type=articles&page=9');
    await settle(harness);
    const root = harness.routeNativeElement!;
    expect(root.querySelectorAll('.directory-card')).toHaveLength(24);
    expect(root.querySelector('results-page')).toBeNull();
    expect(root.querySelector('filters-bar')).toBeNull();
    expect(root.querySelector('select')).toBeNull();
    expect(root.textContent).not.toContain('Manage filters');
    expect(root.querySelector('input')!.getAttribute('aria-label')).toBe('Search ' + path.slice(1));
    expect(root.querySelector('[aria-label="Grid view"]')).toBeTruthy();
    expect(root.querySelector('[aria-label="List view"]')).toBeTruthy();
    for (const card of root.querySelectorAll('.directory-card')) {
      expect(card.querySelector('h2')!.textContent!.trim()).not.toBe('');
      expect(card.querySelector('.directory-description')!.textContent!.trim()).not.toBe('');
      expect(card.querySelector('.featured-apps h3')!.textContent).toBe('Featured apps');
    }
  });

  it('searches the complete taxonomy and switches view without retaining old application filters', async () => {
    const harness = await RouterTestingHarness.create('/categories?platform=desktop&page=9');
    await settle(harness);
    const search = harness.routeDebugElement!.query(By.directive(SearchBarComponent)).componentInstance as SearchBarComponent;
    search.form.controls.search.setValue('wireframing', { emitEvent: false });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('search-bar button')!.click();
    await settle(harness);
    expect(harness.routeNativeElement!.querySelectorAll('.directory-card')).toHaveLength(1);
    expect(harness.routeNativeElement!.querySelector('.directory-link')!.textContent).toContain('Wireframing');
    expect(harness.routeNativeElement!.querySelector('.no-featured-apps')!.textContent).toContain('No apps listed yet');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('[aria-label="List view"]')!.click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/categories?search=wireframing&view=list');
    expect(harness.routeNativeElement!.querySelector('.directory-grid--list')).toBeTruthy();
    await harness.navigateByUrl('/categories?search=photo&view=grid'); await settle(harness);
    expect(search.form.controls.search.value).toBe('photo');
    expect(harness.routeNativeElement!.querySelector('[aria-label="Grid view"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders real example apps under their category and links both levels correctly', async () => {
    const harness = await RouterTestingHarness.create('/categories?search=photo%20editing');
    await settle(harness);
    const card = harness.routeNativeElement!.querySelector('.directory-card')!;
    expect(card.querySelector('.directory-link')!.getAttribute('href')).toBe('/categories/photo-editing');
    expect(card.querySelector('.featured-app')!.getAttribute('href')).toBe('/apps/photo-snap');
    expect(card.querySelector('.featured-app')!.textContent).toContain('Photo Snap');
    (card.querySelector('.directory-link') as HTMLAnchorElement).click(); await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/categories/photo-editing');
    expect(harness.routeNativeElement!.querySelector('results-page')).toBeTruthy();
  });

  it('restores legacy search, handles no matches, and clears back to the tag directory', async () => {
    const harness = await RouterTestingHarness.create('/tags?q=not-a-real-topic&view=list');
    await settle(harness);
    expect(harness.routeNativeElement!.textContent).toContain('No tags found');
    expect(harness.routeNativeElement!.querySelectorAll('.directory-card')).toHaveLength(0);
    const clear = [...harness.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Clear search')!;
    clear.click(); await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/tags?view=list');
    expect(harness.routeNativeElement!.querySelectorAll('.directory-card')).toHaveLength(24);
  });

  it('loads more entries and resets the visible batch for a new search', async () => {
    const harness = await RouterTestingHarness.create('/categories'); await settle(harness);
    const more = harness.routeNativeElement!.querySelector<HTMLButtonElement>('.directory-more button')!;
    more.click(); await settle(harness);
    expect(harness.routeNativeElement!.querySelectorAll('.directory-card')).toHaveLength(48);
    await harness.navigateByUrl('/categories?search=apps'); await settle(harness);
    const page = harness.routeDebugElement!.query(By.directive(CatalogDirectoryPageComponent)).componentInstance as CatalogDirectoryPageComponent;
    expect(page.visibleCount()).toBe(24);
  });
});

describe('directory content', () => {
  it.each(['category', 'tag'] as const)('includes the complete %s taxonomy with descriptions and no duplicate slugs', kind => {
    const entries = catalogDirectory(kind);
    const slugs = entries.map(entry => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const facet of kind === 'category' ? CATEGORIES : TAGS) expect(slugs).toContain(normalizeCatalogFacet(facet.slug));
    expect(entries.every(entry => entry.description.length > 0)).toBe(true);
    expect(entries.some(entry => entry.appCount === 0)).toBe(true);
  });

  it.each(['category', 'tag'] as const)('uses only matching applications for %s examples and counts', kind => {
    const key = kind === 'category' ? 'categories' : 'tags';
    for (const entry of catalogDirectory(kind)) {
      const matching = CATALOG_ENTRIES.filter(app => app.kind === 'applications' &&
        app[key].some(facet => normalizeCatalogFacet(facet.slug) === entry.slug));
      expect(entry.appCount).toBe(matching.length);
      expect(entry.featuredApps.length).toBeLessThanOrEqual(3);
      expect(entry.featuredApps.every(app => matching.includes(app))).toBe(true);
    }
  });

  it('searches names and descriptions rather than treating an app name as a directory entry', () => {
    const entries = catalogDirectory('category');
    expect(searchCatalogDirectory(entries, 'focused work').map(entry => entry.slug)).toEqual(['work-productivity']);
    expect(searchCatalogDirectory(entries, 'Photo Snap')).toHaveLength(0);
    expect(searchCatalogDirectory(entries, '  PHOTO   editing ').map(entry => entry.slug)).toEqual(['photo-editing']);
  });
});
