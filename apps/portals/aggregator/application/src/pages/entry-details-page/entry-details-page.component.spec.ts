import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { EntryDetailsPageComponent } from './entry-details-page.component';
import { MySuitesPageComponent } from '../my-suites/my-suites.component';

describe('Entry details navigation', () => {
  beforeEach(() => {
    localStorage.removeItem('wapps.suite-drafts.v1');
    TestBed.configureTestingModule({ providers: [
      provideNoopAnimations(),
      provideRouter([
        { path: 'articles/:articleSlug', component: EntryDetailsPageComponent },
        { path: 'suites/create', component: EntryDetailsPageComponent },
        { path: 'suites/:suiteSlug', component: EntryDetailsPageComponent },
        { path: 'my/suites', component: MySuitesPageComponent },
      ]),
      { provide: MyFavoritesService, useValue: { isFavorite$: () => of(false) } },
    ] });
  });
  afterEach(() => localStorage.removeItem('wapps.suite-drafts.v1'));

  it('updates article content and not-found states when only the slug changes', async () => {
    const harness = await RouterTestingHarness.create('/articles/tech-trends-2024');
    expect(harness.routeNativeElement?.textContent).toContain('Evaluate a trend through a concrete problem');
    await harness.navigateByUrl('/articles/design-principles-modern-apps');
    expect(harness.routeNativeElement?.textContent).toContain('Design every state');
    expect(harness.routeNativeElement?.textContent).not.toContain('Evaluate a trend');
    await harness.navigateByUrl('/articles/does-not-exist');
    expect(harness.routeNativeElement?.textContent).toContain('Article not found');
  });

  it('links suite apps to catalog records without install actions', async () => {
    const harness = await RouterTestingHarness.create('/suites/creative-tools-suite');
    expect(harness.routeNativeElement?.querySelector('a[href="/apps/photo-snap"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).not.toContain('Install');
  });

  it('creates a suite from the form and displays it in My suites', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/suites/create', EntryDetailsPageComponent);
    const title = harness.routeNativeElement!.querySelector<HTMLInputElement>('#suite-title')!;
    title.value = 'Weekend tools';
    title.dispatchEvent(new Event('input'));
    const checkbox = harness.routeNativeElement!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    await component.saveSuite();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Weekend tools');
    expect(harness.routeNativeElement?.textContent).toContain('Saved in this browser only');
    expect(harness.routeNativeElement?.querySelector('a[href="/apps/photo-snap"]')).not.toBeNull();
    await harness.navigateByUrl('/my/suites');
    expect(harness.routeNativeElement?.querySelector('a[href="/suites/weekend-tools"]')).not.toBeNull();
  });

  it('keeps an invalid form open and shows the empty My suites state', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/suites/create', EntryDetailsPageComponent);
    await component.saveSuite();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain('Enter a title');
    expect(localStorage.getItem('wapps.suite-drafts.v1')).toBeNull();
    await harness.navigateByUrl('/my/suites');
    expect(harness.routeNativeElement?.textContent).toContain('No suites yet');
  });
});
