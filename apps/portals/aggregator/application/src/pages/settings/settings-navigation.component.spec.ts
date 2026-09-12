import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PageHeaderComponent, PageTitleComponent } from '@ui/layout';
import { SettingsPageComponent } from './settings.component';
import { SettingsNavigationComponent } from './settings-navigation.component';

@Component({
  imports: [PageHeaderComponent, PageTitleComponent, SettingsNavigationComponent],
  template: `<ui-page-header>
    <span slot="top-bar">Breadcrumbs</span>
    <h1 uiPageTitle slot="title">Settings</h1>
    <p slot="meta">Description</p>
    <settings-navigation slot="navigation" />
  </ui-page-header>`,
})
class SettingsSection {}

describe('Settings header navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([
    { path: 'me/settings', component: SettingsPageComponent, children:
      ['profile', 'preferences', 'notifications', 'privacy'].map(path => ({ path, component: SettingsSection })) },
  ])] }));

  it.each([
    ['profile', 'Profile Settings'], ['preferences', 'Display & Content'],
    ['notifications', 'Notifications'], ['privacy', 'Privacy & Data'],
  ])('shows one navigation row below the description on direct entry to %s', async (path, label) => {
    const harness = await RouterTestingHarness.create('/me/settings/' + path);
    await harness.fixture.whenStable(); harness.detectChanges();
    const page = harness.routeNativeElement!;
    expect(page.querySelectorAll('nav[aria-label="Settings sections"]')).toHaveLength(1);
    const header = page.querySelector('ui-page-header > .page-header')!;
    expect(header.lastElementChild!.tagName).toBe('SETTINGS-NAVIGATION');
    const active = page.querySelectorAll('[aria-current="page"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent!.trim()).toBe(label);
    expect(active[0].getAttribute('data-appearance')).toBe('primary');
  });

  it('switches sections and reveals the active link by scrolling only its row', async () => {
    const harness = await RouterTestingHarness.create('/me/settings/profile');
    const links = harness.routeNativeElement!.querySelectorAll<HTMLAnchorElement>('settings-navigation a');
    links[3].click();
    await harness.fixture.whenStable(); harness.detectChanges();
    // The newly routed section initializes its RouterLinkActive directives after rendering.
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/me/settings/privacy');
    const navDebug = harness.routeDebugElement!.query(By.directive(SettingsNavigationComponent));
    const nav = navDebug.nativeElement.querySelector('nav');
    const link = nav.querySelector('[aria-current="page"]');
    Object.defineProperty(nav, 'clientWidth', { value: 320 });
    Object.defineProperty(link, 'offsetLeft', { value: 400 });
    Object.defineProperty(link, 'offsetWidth', { value: 100 });
    const scrollPage = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    navDebug.componentInstance.reveal(link);
    expect(nav.scrollLeft).toBe(290);
    expect(scrollPage).not.toHaveBeenCalled();
    scrollPage.mockRestore();
  });
});
