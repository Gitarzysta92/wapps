import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter, Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SafeComponentOutletDirective } from '@ui/misc';
import { NAVIGATION } from '../navigation';
import { SettingsPageComponent } from '../pages/settings/settings.component';
import { SettingsNavigationComponent } from '../pages/settings/settings-navigation.component';
import { routes } from '../routes';

@Component({
  imports: [AsyncPipe, SafeComponentOutletDirective, SettingsNavigationComponent],
  template: `@if (route.data | async; as data) {
    @let bottomBar = data['bottomBar'];
    @if (data['breadcrumb']?.[1]?.path === 'me/settings') { <settings-navigation /> }
    <ng-container [safeComponentOutlet]="bottomBar.component"
      [safeComponentOutletInputs]="bottomBar.inputs" />
  }`,
})
class Destination {
  readonly route = inject(ActivatedRoute);
}

// Keep the real nested routes, redirects and navigation resolvers, without page data dependencies.
const portalRoutes = routes[0].children!;
const settingsRoute = portalRoutes.find(route => route.path === NAVIGATION.settings.path)!;
const accountRoutes = portalRoutes.filter(route => [
  NAVIGATION.myProfile.path, NAVIGATION.myFavorite.path, NAVIGATION.myDiscussions.path,
  NAVIGATION.userProfile.path,
].includes(route.path!));
const homeRoute = portalRoutes.find(route => route.component)!;
const accountMenu = ['Profile', 'Favorites', 'Settings', 'Explore'];
const publicMenu = ['User profile', 'My profile', 'Explore'];

function destination(route: Route): Route {
  return route.redirectTo ? {
    path: route.path, pathMatch: route.pathMatch, redirectTo: route.redirectTo,
  } : {
    path: route.path, component: Destination, data: route.data,
    resolve: route.resolve && { bottomBar: route.resolve['bottomBar'] },
  };
}

describe('Mobile profile navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideNoopAnimations(),
    provideRouter([
      ...accountRoutes.map(destination),
      { path: settingsRoute.path, component: SettingsPageComponent,
        data: settingsRoute.data, children: settingsRoute.children!.map(destination) },
      { path: '', component: Destination, data: homeRoute.data },
    ]),
  ] }));

  async function settle(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable(); harness.detectChanges();
    await harness.fixture.whenStable(); harness.detectChanges();
  }

  function expectMenu(harness: RouterTestingHarness, labels: string[], activeLabel: string): void {
    const page = harness.routeNativeElement!;
    expect(page.querySelectorAll('nav')).toHaveLength(1);
    const links = page.querySelectorAll<HTMLAnchorElement>('nav a');
    expect(Array.from(links, link => link.getAttribute('aria-label'))).toEqual(labels);
    expect(links[links.length - 1].getAttribute('href')).toBe('/');
    expect(page.querySelector('nav button:last-child')!.getAttribute('aria-label')).toBe('Account menu');
    const active = page.querySelectorAll('nav [aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('aria-label')).toBe(activeLabel);
  }

  it.each([
    ['/me/profile', accountMenu, 'Profile'],
    ['/me/favorite', accountMenu, 'Favorites'],
    ['/me/discussions', accountMenu, 'Profile'],
    ['/me/settings', accountMenu, 'Settings'],
    ['/me/settings/profile', accountMenu, 'Settings'],
    ['/me/settings/preferences', accountMenu, 'Settings'],
    ['/me/settings/notifications', accountMenu, 'Settings'],
    ['/me/settings/privacy', accountMenu, 'Settings'],
    ['/me/settings/privacy?view=compact#data', accountMenu, 'Settings'],
    ['/me/settings/profile;view=compact', accountMenu, 'Settings'],
    ['/profiles/user-1', publicMenu, 'User profile'],
    ['/profiles/unknown', publicMenu, 'User profile'],
  ] as const)('selects the correct section on direct entry to %s', async (url, labels, active) => {
    const harness = await RouterTestingHarness.create(url);
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe(url === '/me/settings' ? '/me/settings/profile' : url);
    expectMenu(harness, [...labels], active);
  });

  it('keeps the account menu stable through nested settings, then restores the home menu', async () => {
    const harness = await RouterTestingHarness.create('/me/profile');
    await settle(harness);
    for (const [link, url, labels, active] of [
      ['Favorites', '/me/favorite', accountMenu, 'Favorites'],
      ['Settings', '/me/settings/profile', accountMenu, 'Settings'],
    ] as const) {
      harness.routeNativeElement!.querySelector<HTMLAnchorElement>(`a[aria-label="${link}"]`)!.click();
      await settle(harness);
      expect(TestBed.inject(Router).url).toBe(url);
      expectMenu(harness, [...labels], active);
    }
    const originalLinks = Array.from(harness.routeNativeElement!.querySelectorAll('nav a'), link => link.getAttribute('href'));
    for (const [section, label] of [
      ['profile', 'Profile Settings'], ['preferences', 'Display & Content'],
      ['notifications', 'Notifications'], ['privacy', 'Privacy & Data'],
    ]) {
      await harness.navigateByUrl('/me/settings/' + section);
      await settle(harness);
      expectMenu(harness, accountMenu, 'Settings');
      expect(Array.from(harness.routeNativeElement!.querySelectorAll('nav a'), link => link.getAttribute('href'))).toEqual(originalLinks);
      expect(harness.routeNativeElement!.querySelectorAll('settings-navigation button')).toHaveLength(1);
      expect(harness.routeNativeElement!.querySelector('settings-navigation button')!.getAttribute('aria-label')).toBe('Settings section: ' + label);
      expect(harness.routeNativeElement!.querySelector('settings-navigation button')!.getAttribute('aria-expanded')).toBe('false');
    }
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[aria-label="Profile"]')!.click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/me/profile');
    expectMenu(harness, accountMenu, 'Profile');
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[aria-label="Explore"]')!.click();
    await settle(harness);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(Array.from(harness.routeNativeElement!.querySelectorAll('nav a'), link => link.getAttribute('aria-label')))
      .toEqual(['Explore', 'Discover', 'Digest', 'Suites']);
    expect(harness.routeNativeElement!.querySelector('nav [aria-current="page"]')!.getAttribute('aria-label')).toBe('Explore');
  });

  it('resolves the viewed profile and keeps private settings separate from another member', async () => {
    const harness = await RouterTestingHarness.create('/profiles/user-1');
    await settle(harness);
    for (const id of ['user-1', 'user-2']) {
      await harness.navigateByUrl('/profiles/' + id);
      await settle(harness);
      expectMenu(harness, publicMenu, 'User profile');
      expect(harness.routeNativeElement!.querySelector('a[aria-label="User profile"]')!.getAttribute('href')).toBe('/profiles/' + id);
      expect(harness.routeNativeElement!.querySelector('a[aria-label="My profile"]')!.getAttribute('href')).toBe('/me/profile');
      expect(harness.routeNativeElement!.querySelector('a[aria-label="Settings"]')).toBeNull();
    }
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('a[aria-label="My profile"]')!.click();
    await settle(harness);
    expectMenu(harness, accountMenu, 'Profile');
  });
});
