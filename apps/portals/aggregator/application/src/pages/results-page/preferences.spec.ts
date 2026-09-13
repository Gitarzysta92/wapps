import { signal } from '@angular/core';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { By } from '@angular/platform-browser';
import { TuiDropdowns, TuiDropdownDirective } from '@taiga-ui/core/directives/dropdown';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { PreferencesService, providePreferencesFeature } from '@portals/shared/features/preferences';
import { ResultsPageComponent } from './results-page.component';

async function settle(harness: RouterTestingHarness) {
  harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
  await harness.fixture.whenStable(); harness.detectChanges();
}


async function openDisplayOptions(harness: RouterTestingHarness): Promise<HTMLElement> {
  const trigger = harness.routeDebugElement!
    .queryAll(By.directive(TuiDropdownDirective))
    .find(element => element.nativeElement.textContent.trim() === 'Display options')!;
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
  return document.querySelector<HTMLElement>('.catalog-display-options')!;
}

describe('listing display preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
        { provide: TUI_DARK_MODE, useValue: signal(false) },
      provideNoopAnimations(), provideRouter([{ path: 'catalog', component: ResultsPageComponent }]),
      ...providePreferencesFeature({ apiBaseUrl: '' }).providers
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); Reflect.deleteProperty(document, 'elementFromPoint'); });

  it('uses saved defaults, honors explicit URL values, and falls back for invalid values', async () => {
    await firstValueFrom(TestBed.inject(PreferencesService).updateDisplayPreferences({ defaultView: 'list', itemsPerPage: 10 }));
    const harness = await RouterTestingHarness.create('/catalog');
    const page = await harness.navigateByUrl('/catalog', ResultsPageComponent);
    await settle(harness);
    expect(page.view()).toBe('list'); expect(page.query().pageSize).toBe(10);
    expect(harness.routeNativeElement?.querySelector('.items-grid--list')).not.toBe(null);
    await harness.navigateByUrl('/catalog?view=grid&pageSize=3'); await settle(harness);
    expect(page.view()).toBe('grid'); expect(page.query().pageSize).toBe(3);
    await harness.navigateByUrl('/catalog?view=bad&pageSize=-7'); await settle(harness);
    expect(page.view()).toBe('list'); expect(page.query().pageSize).toBe(10);
  });

  it('applies preference updates and all supported page sizes without clamping 50 or 100', async () => {
    const harness = await RouterTestingHarness.create('/catalog');
    const page = await harness.navigateByUrl('/catalog', ResultsPageComponent);
    for (const size of [10, 20, 50, 100]) {
      await firstValueFrom(TestBed.inject(PreferencesService).updateDisplayPreferences({ itemsPerPage: size }));
      await settle(harness);
      expect(page.query().pageSize).toBe(size);
      expect(page.result.value()?.pageSize).toBe(size);
      const filterPanel = await openDisplayOptions(harness);
      const perPage = Array.from(filterPanel.querySelectorAll('select')).find(select => Array.from(select.options).some(option => option.value === '100'));
      expect(perPage?.value).toBe(String(size));
    }
  });

  it('formats existing dates reactively and keeps view selections in the URL', async () => {
    const preferences = TestBed.inject(PreferencesService);
    await firstValueFrom(preferences.updateDisplayPreferences({ dateFormat: 'YYYY-MM-DD' }));
    const harness = await RouterTestingHarness.create('/catalog?search=Photo'); await settle(harness);
    const time = harness.routeNativeElement?.querySelector('time');
    expect(time?.textContent?.trim()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await firstValueFrom(preferences.updateDisplayPreferences({ dateFormat: 'MM/DD/YYYY' }));
    harness.detectChanges();
    expect(time?.textContent?.trim()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    const filterPanel = await openDisplayOptions(harness);
    const view = Array.from(filterPanel.querySelectorAll('select')).find(select => Array.from(select.options).some(option => option.value === 'list'));
    if (!view) throw new Error('View control missing');
    view.value = 'list'; view.dispatchEvent(new Event('change')); await settle(harness);
    expect(TestBed.inject(Router).url).toContain('view=list');
    expect(TestBed.inject(Router).url).toContain('search=Photo');
  });
});
