import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { APPLICATION_OVERVIEW_PROVIDER } from '@portals/shared/features/application-overview';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { PreferencesService } from '@portals/shared/features/preferences';
import { ApplicationOverviewPageComponent } from '../pages/application-overview-page/application-overview-page.component';
import { ApplicationTimelinePageComponent } from '../pages/application-timeline-page/application-timeline-page.component';
import { ApplicationDevlogPageComponent } from '../pages/application-devlog-page/application-devlog-page.component';
import { ApplicationHealthPageComponent } from '../pages/application-health-page/application-health-page.component';
import { ApplicationReviewsPageComponent } from '../pages/application-reviews-page/application-reviews-page.component';
import { ApplicationDiscussionsPageComponent } from '../pages/application-discussions-page/application-discussions-page.component';
import { ApplicationDiscussionPageComponent } from '../pages/application-discussion-page/application-discussion-page.component';
import { APPLICATIONS } from '@portals/shared/data';

const pages = [
  ['overview', ApplicationOverviewPageComponent], ['timeline', ApplicationTimelinePageComponent],
  ['devlog', ApplicationDevlogPageComponent], ['health', ApplicationHealthPageComponent],
  ['reviews', ApplicationReviewsPageComponent], ['discussions', ApplicationDiscussionsPageComponent],
  ['discussions/:discussionSlug', ApplicationDiscussionPageComponent],
] as const;

describe('application missing and error states', () => {
  const provider = { getOverview: jest.fn() };
  beforeEach(() => {
    provider.getOverview.mockReset().mockReturnValue(of({ ok: false, error: { status: 404 } }));
    TestBed.configureTestingModule({ providers: [
      provideNoopAnimations(),
      provideRouter(pages.map(([path, component]) => ({ path: 'apps/:appSlug/' + path, component, data: { breadcrumb: [] } })), withComponentInputBinding()),
      { provide: APPLICATION_OVERVIEW_PROVIDER, useValue: provider },
      { provide: MyFavoritesService, useValue: { isFavorite$: () => of(false) } },
      { provide: PreferencesService, useValue: { dateFormat: signal('yyyy-MM-dd') } },
    ] });
  });

  it.each(pages.map(([path]) => path))('offers a catalog return route on missing %s', async path => {
    const harness = await RouterTestingHarness.create('/apps/not-a-real-app/' + path.replace(':discussionSlug', 'missing'));
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('not found');
    expect(harness.routeNativeElement?.querySelector('ui-content-state a[href="/app"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not show a 404 while loading, and retries a service error successfully', async () => {
    const pending = new Subject<unknown>();
    provider.getOverview.mockReturnValueOnce(pending).mockReturnValueOnce(of({ ok: true, value: APPLICATIONS[0] }));
    const harness = await RouterTestingHarness.create('/apps/photo-snap/overview');
    expect(harness.routeNativeElement?.querySelector('ui-content-state')).toBeNull();
    pending.next({ ok: false, error: { status: 503 } }); pending.complete();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('[role="alert"]')?.textContent).toContain('Unable to load application');
    expect(harness.routeNativeElement?.textContent).not.toContain('Application not found');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('ui-content-state button')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('ui-content-state [role="alert"]')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.hero-section')).not.toBeNull();
    expect(provider.getOverview).toHaveBeenCalledTimes(2);
  });

  it('shows an empty review state without NaN ratings or misleading completion text', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/apps/photo-snap/reviews', ApplicationReviewsPageComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    page.reviewsData.set({ reviews: [] });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No reviews yet');
    expect(harness.routeNativeElement?.textContent).not.toContain('NaN');
    expect(harness.routeNativeElement?.textContent).not.toContain('All available reviews are shown');
    expect(harness.routeNativeElement?.querySelector('a[href="/apps/photo-snap/overview"]')).not.toBeNull();
  });

  it('returns a missing conversation to discussions for the same application', async () => {
    const harness = await RouterTestingHarness.create('/apps/photo-snap/discussions/missing');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('a[href="/apps/photo-snap/discussions"]')).not.toBeNull();
  });
});
