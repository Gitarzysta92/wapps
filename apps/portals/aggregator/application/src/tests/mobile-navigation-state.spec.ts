import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { CommonMobileBottomBarPartialComponent } from '../partials/common-mobile-bottom-bar/common-mobile-bottom-bar.component';
import { MOBILE_MAIN_NAVIGATION } from '../navigation';

@Component({ template: '' })
class Page {}

@Component({
  imports: [CommonMobileBottomBarPartialComponent, RouterOutlet],
  template: `<router-outlet />
    <common-mobile-bottom-bar [navigationPrimary]="navigation" />`,
})
class Shell {
  navigation = MOBILE_MAIN_NAVIGATION;
}

describe('Reused mobile navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideNoopAnimations(),
    provideRouter([
      { path: 'blocked', component: Page, canActivate: [() => false] },
      { path: 'search', redirectTo: 'discover', pathMatch: 'full' },
      { path: '**', component: Page },
    ]),
  ] }));

  async function setup() {
    const fixture = TestBed.createComponent(Shell);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function active(fixture: ReturnType<typeof TestBed.createComponent>): string[] {
    const links = fixture.nativeElement.querySelectorAll('common-mobile-bottom-bar a');
    return Array.from(links as NodeListOf<HTMLAnchorElement>).filter(link => {
      expect(link.classList.contains('active')).toBe(link.getAttribute('aria-current') === 'page');
      return link.classList.contains('active');
    }).map(link => link.getAttribute('aria-label')!);
  }

  it('updates after completed navigation even when all menu inputs stay unchanged', async () => {
    const fixture = await setup();
    const menu = fixture.nativeElement.querySelector('common-mobile-bottom-bar');
    for (const [url, label] of [
      ['/discover', 'Discover'], ['/digest', 'Digest'], ['/', 'Explore'],
      ['/suites/productivity?view=grid#reviews', 'Suites'],
      ['/search', 'Discover'], ['/', 'Explore'],
    ]) {
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('common-mobile-bottom-bar')).toBe(menu);
      expect(active(fixture)).toEqual([label]);
    }
  });

  it('keeps the current route selected when navigation is cancelled', async () => {
    const fixture = await setup();
    expect(await TestBed.inject(Router).navigateByUrl('/blocked')).toBe(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(active(fixture)).toEqual(['Explore']);
  });

  it('matches an absolute root link exactly', async () => {
    const fixture = await setup();
    fixture.componentInstance.navigation = MOBILE_MAIN_NAVIGATION.map(item => ({ ...item, path: '/' + item.path }));
    await TestBed.inject(Router).navigateByUrl('/discover');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(active(fixture)).toEqual(['Discover']);
  });
});
