import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { CommonSidebarComponent } from '../partials/common-sidebar/common-sidebar.component';
import { DESKTOP_USER_MAIN_NAVIGATION, NAVIGATION, SETTINGS_NAVIGATION } from '../navigation';
import { SafeComponentOutletDirective } from '@ui/misc';

@Component({ standalone: true, template: '' })
class Destination {}

@Component({ standalone: true, template: '{{ submenu().join(",") }}' })
class OutletChild { readonly submenu = input<string[]>([]); readonly title = input(''); }

@Component({
  standalone: true,
  imports: [SafeComponentOutletDirective],
  template: '<ng-container *safeComponentOutlet="child; inputs: bindings" />',
})
class OutletHost {
  child = OutletChild;
  bindings: Record<string, unknown> = { submenu: ['Profile', 'Preferences'], title: 'Settings' };
}

describe('sidebar navigation state', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [CommonSidebarComponent, OutletHost],
    providers: [provideNoopAnimations(), provideRouter([
      { path: 'me/settings', pathMatch: 'full', redirectTo: 'me/settings/profile' },
      { path: '**', component: Destination },
    ])],
  }));

  async function setup(url: string, secondary: typeof SETTINGS_NAVIGATION | null = SETTINGS_NAVIGATION, primary = DESKTOP_USER_MAIN_NAVIGATION) {
    const fixture = TestBed.createComponent(CommonSidebarComponent);
    fixture.componentRef.setInput('navigation', primary);
    fixture.componentRef.setInput('navigationSecondary', secondary);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function active(fixture: ReturnType<typeof TestBed.createComponent>): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('nav a.active') as NodeListOf<HTMLElement>)
      .map(el => el.textContent!.trim());
  }

  for (const [url, expected] of [
    ['/', 'Home'],
    ['/me/profile', 'Overview'],
    ['/me/settings', 'Profile Settings'],
    ['/me/settings/profile', 'Profile Settings'],
    ['/me/settings/preferences', 'Display & Content'],
    ['/me/settings/notifications', 'Notifications'],
    ['/me/settings/privacy', 'Privacy & Data'],
    ['/me/settings/preferences?sort=recent#content', 'Display & Content'],
    ['/me/settings/preferences;view=list', 'Display & Content'],
  ]) {
    it(`highlights only ${expected} for ${url}`, async () => {
      expect(active(await setup(url))).toEqual([expected]);
    });
  }

  it('does not match parent links for a different leaf', async () => {
    expect(active(await setup('/me/settings/preferences/unknown'))).toEqual([]);
  });

  it('does not match a sibling with a common URL prefix', async () => {
    expect(active(await setup('/me/settings/privacy-extra'))).toEqual([]);
  });

  it('highlights the Preferences shortcut when no submenu is present', async () => {
    expect(active(await setup('/me/settings/preferences', [], [NAVIGATION.performance]))).toEqual(['Preferences']);
  });

  it('highlights Home when route data explicitly sets the submenu to null', async () => {
    expect(active(await setup('/', null))).toEqual(['Home']);
  });

  it('updates the active item through repeated route transitions', async () => {
    const fixture = await setup('/me/settings/profile');
    for (const [url, expected] of [
      ['/me/settings/privacy', 'Privacy & Data'],
      ['/me/profile', 'Overview'],
      ['/me/settings/preferences', 'Display & Content'],
      ['/', 'Home'],
    ]) {
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(active(fixture)).toEqual([expected]);
    }
  });

  it('removes the shortcut highlight when a submenu is added to an existing sidebar', async () => {
    const fixture = await setup('/me/settings/preferences', [], [NAVIGATION.performance]);
    expect(active(fixture)).toEqual(['Preferences']);
    fixture.componentRef.setInput('navigationSecondary', SETTINGS_NAVIGATION);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(active(fixture)).toEqual(['Display & Content']);
    fixture.componentRef.setInput('navigationSecondary', []);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(active(fixture)).toEqual(['Preferences']);
  });

  it('shows only Home, Overview and the four settings destinations in the user menu', async () => {
    const fixture = await setup('/me/settings/profile');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav a') as NodeListOf<HTMLElement>)
      .map(el => el.textContent!.trim());
    expect(labels).toEqual(['Home', 'Overview', 'Profile Settings', 'Display & Content', 'Notifications', 'Privacy & Data']);
  });

  it('restores omitted route inputs to defaults instead of retaining the previous submenu', () => {
    const fixture = TestBed.createComponent(OutletHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('Profile,Preferences');
    fixture.componentInstance.bindings = { title: 'Overview' };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('');
    fixture.componentInstance.bindings = { title: 'Settings', submenu: ['Notifications'] };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('Notifications');
  });
});
