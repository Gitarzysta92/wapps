import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PreferencesService, PREFERENCES_STORAGE_KEY, providePreferencesFeature } from '@portals/shared/features/preferences';
import { THEME_PROVIDER_CFG_TOKEN, THEME_PROVIDER_TOKEN } from './constants';
import { ThemeToggleComponent } from './components/theme-toggle.component';
import { ThemingService } from './theming.service';
import { ThemingDescriptorDirective } from './theming-descriptor.directive';

@Component({ standalone: true, imports: [ThemingDescriptorDirective], template: '<div themingDescriptor></div>' })
class ThemeHostComponent {}

describe('persisted theme behavior', () => {
  let dark: boolean;
  let listeners: Set<() => void>;
  let media: MediaQueryList;
  const configure = () => TestBed.configureTestingModule({ providers: [
    ...providePreferencesFeature({ apiBaseUrl: '' }).providers,
    ThemingService,
    { provide: THEME_PROVIDER_TOKEN, useExisting: ThemingService },
    { provide: THEME_PROVIDER_CFG_TOKEN, useValue: { darkThemeName: 'dark', lightThemeName: 'light', attributeName: 'tuiTheme' } }
  ] });
  beforeEach(() => {
    localStorage.clear();
    dark = false;
    listeners = new Set();
    media = {
      get matches() { return dark; },
      addEventListener: jest.fn((_event, listener: () => void) => listeners.add(listener)),
      removeEventListener: jest.fn((_event, listener: () => void) => listeners.delete(listener))
    } as unknown as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => media) });
    configure();
  });
  afterEach(() => { TestBed.resetTestingModule(); jest.restoreAllMocks(); });

  it.each(['light', 'dark', 'auto'] as const)('restores %s on a fresh service instance', async selection => {
    dark = true;
    await firstValueFrom(TestBed.inject(PreferencesService).updateDisplayPreferences({ theme: selection }));
    TestBed.resetTestingModule();
    configure();
    expect(TestBed.inject(ThemingService).theme$.value).toBe(selection === 'light' ? 'light' : 'dark');
  });

  it('responds to System changes, ignores them for explicit modes, and removes its listener', async () => {
    const theme = TestBed.inject(ThemingService);
    const preferences = TestBed.inject(PreferencesService);
    expect(theme.theme$.value).toBe('light');
    dark = true; listeners.forEach(listener => listener());
    expect(theme.theme$.value).toBe('dark');
    await firstValueFrom(preferences.updateDisplayPreferences({ theme: 'light' }));
    listeners.forEach(listener => listener());
    expect(theme.theme$.value).toBe('light');
    await firstValueFrom(preferences.updateDisplayPreferences({ theme: 'auto' }));
    expect(theme.theme$.value).toBe('dark');
    TestBed.resetTestingModule();
    expect(listeners.size).toBe(0);
  });

  it('persists header toggles and does not apply a failed write', async () => {
    const theme = TestBed.inject(ThemingService);
    await theme.toggle();
    expect(theme.theme$.value).toBe('dark');
    expect(JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}').display.theme).toBe('dark');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await theme.toggle();
    expect(theme.theme$.value).toBe('dark');
    expect(theme.error$.value).toContain('Could not save');
  });

  it('updates actual theme attributes and classes when preferences change', async () => {
    const fixture = TestBed.createComponent(ThemeHostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(element.getAttribute('tuiTheme')).toBe('light');
    await firstValueFrom(TestBed.inject(PreferencesService).updateDisplayPreferences({ theme: 'dark' }));
    expect(element.getAttribute('tuiTheme')).toBe('dark');
    expect(element.classList.contains('dark')).toBe(true);
    expect(element.classList.contains('light')).toBe(false);
  });

  it('normalizes invalid stored display values before exposing preferences', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ display: { theme: 'invalid', defaultView: 'table', dateFormat: '???', itemsPerPage: -1 } }));
    const preferences = TestBed.inject(PreferencesService);
    expect(preferences.display()).toMatchObject({ theme: 'auto', defaultView: 'grid', dateFormat: 'DD/MM/YYYY', itemsPerPage: 20 });
    expect(TestBed.inject(ThemingService).theme$.value).toBe('light');
  });
  it('keeps the toggle control aligned with the applied theme when storage rejects a change', async () => {
    const fixture = TestBed.createComponent(ThemeToggleComponent);
    fixture.detectChanges();
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('input');
    checkbox.click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(checkbox.checked).toBe(true);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    checkbox.click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(checkbox.checked).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Could not save');
  });

});
