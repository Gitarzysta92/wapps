import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SafeComponentOutletDirective } from '@ui/misc';
import { routes } from '../routes';
import { NAVIGATION } from '../navigation';

@Component({
  imports: [AsyncPipe, SafeComponentOutletDirective],
  template: `@if (route.data | async; as data) {
    <ng-container [safeComponentOutlet]="data['bottomBar'].component"
      [safeComponentOutletInputs]="data['bottomBar'].inputs" />
  }`,
})
class Destination {
  readonly route = inject(ActivatedRoute);
}

// Exercise the real route declarations without loading unrelated page features.
const portalRoutes = routes[0].children!;
const applicationRoutes = portalRoutes.find(route => route.children?.some(
  child => child.path === NAVIGATION.applicationOverview.path,
))!.children!;
const destinations = [
  ['overview', 'Overview'], ['timeline', 'Timeline'], ['reviews', 'Reviews'],
  ['devlog', 'Dev log'], ['health', 'Health'], ['discussions', 'Discussions'],
  ['devlog/2.1.0', 'Dev log'], ['review/a-review', 'Reviews'],
  ['discussions/oauth-implementation', 'Discussions'],
];

describe('Mobile application navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideNoopAnimations(),
    provideRouter([
      ...applicationRoutes.map(route => route.redirectTo ? {
        path: route.path, pathMatch: route.pathMatch, redirectTo: route.redirectTo,
      } : {
        path: route.path, component: Destination,
        resolve: { bottomBar: route.resolve!['bottomBar'] },
      }),
      { path: '', component: Destination, data: portalRoutes.find(route => route.component)!.data },
    ]),
  ] }));

  async function settle(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable(); harness.detectChanges();
    await harness.fixture.whenStable(); harness.detectChanges();
  }

  function activeSection(harness: RouterTestingHarness): string | undefined {
    const active = harness.routeNativeElement!.querySelectorAll('[aria-label="Primary mobile navigation"] [aria-current="page"]');
    expect(active).toHaveLength(1);
    return active[0].getAttribute('aria-label') ?? undefined;
  }

  it.each(destinations)('provides Explore and all six sections and highlights %s on direct entry', async (path, label) => {
    const harness = await RouterTestingHarness.create('/apps/photo-snap/' + path);
    await settle(harness);
    const links = harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('[aria-label="Primary mobile navigation"] a');
    expect(Array.from(links, link => link.getAttribute('aria-label'))).toEqual([
      'Overview', 'Timeline', 'Reviews', 'Dev log', 'Health', 'Discussions', 'Explore',
    ]);
    expect(links[6].getAttribute('href')).toBe('/');
    expect(Array.from(links).slice(0, -1).map(link => link.getAttribute('href'))).toEqual([
      'overview', 'timeline', 'reviews', 'devlog', 'health', 'discussions',
    ].map(section => '/apps/photo-snap/' + section));
    expect(activeSection(harness)).toBe(label);
    expect(harness.routeNativeElement!.querySelectorAll('nav')).toHaveLength(1);
    expect(harness.routeNativeElement!.querySelector('[aria-label="Account menu"]')).not.toBeNull();
  });

  it('opens Timeline from its link, resolves a different application, and clears the menu on Explore', async () => {
    const harness = await RouterTestingHarness.create('/apps/photo-snap/overview');
    await settle(harness);
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('[aria-label="Primary mobile navigation"] a[href$="/timeline"]')!.click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/apps/photo-snap/timeline');
    expect(activeSection(harness)).toBe('Timeline');

    await harness.navigateByUrl('/apps/quick-task/health');
    await settle(harness);
    expect(activeSection(harness)).toBe('Health');
    expect(harness.routeNativeElement!.querySelector('a[aria-label="Overview"]')!.getAttribute('href'))
      .toBe('/apps/quick-task/overview');

    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[aria-label="Explore"]')!.click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement!.querySelectorAll('nav')).toHaveLength(1);
    expect(harness.routeNativeElement!.querySelectorAll('nav a')).toHaveLength(4);
    expect(harness.routeNativeElement!.querySelector('a[aria-label="Timeline"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[aria-current="page"]')!.getAttribute('aria-label')).toBe('Explore');
  });

  it('keeps the section selected through the application redirect and query/fragment navigation', async () => {
    const harness = await RouterTestingHarness.create('/apps/photo-snap');
    await settle(harness);
    expect(activeSection(harness)).toBe('Overview');
    await harness.navigateByUrl('/apps/photo-snap/discussions?sort=recent#threads');
    await settle(harness);
    expect(activeSection(harness)).toBe('Discussions');
  });
});
