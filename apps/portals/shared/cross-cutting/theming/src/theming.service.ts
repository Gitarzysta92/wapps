import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { IThemingProvider } from './theming.interface';
import { THEME_PROVIDER_CFG_TOKEN } from './constants';
import { THEME_PREFERENCES, ThemeSelection } from './theme-preferences.port';

@Injectable()
export class ThemingService implements IThemingProvider {
  private readonly cfg = inject(THEME_PROVIDER_CFG_TOKEN);
  private readonly preferences = inject(THEME_PREFERENCES, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly systemTheme = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private selection: ThemeSelection = 'auto';
  private saving = false;

  public readonly theme$ = new BehaviorSubject(this.resolveTheme());
  public readonly isToggled$ = this.theme$.pipe(map(theme => theme === this.cfg.darkThemeName));
  public readonly error$ = new BehaviorSubject<string | null>(null);

  constructor() {
    const onSystemChange = () => {
      if (this.selection === 'auto') this.applyTheme();
    };
    this.systemTheme?.addEventListener('change', onSystemChange);
    this.destroyRef.onDestroy(() => this.systemTheme?.removeEventListener('change', onSystemChange));
    this.preferences?.selection$.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe(selection => {
      this.selection = ['light', 'dark', 'auto'].includes(selection) ? selection : 'auto';
      this.applyTheme();
    });
  }

  private resolveTheme(): string {
    const dark = this.selection === 'dark' || (this.selection === 'auto' && !!this.systemTheme?.matches);
    return dark ? this.cfg.darkThemeName : this.cfg.lightThemeName;
  }

  private applyTheme(): void {
    this.theme$.next(this.resolveTheme());
    this.error$.next(null);
  }

  public async toggle(): Promise<void> {
    if (this.saving) return;
    const selection: ThemeSelection = this.theme$.value === this.cfg.darkThemeName ? 'light' : 'dark';
    this.saving = true;
    this.error$.next(null);
    try {
      if (this.preferences && !await firstValueFrom(this.preferences.save(selection))) {
        throw new Error('Theme could not be saved');
      }
      this.selection = selection;
      this.applyTheme();
    } catch {
      this.error$.next('Could not save the theme on this browser.');
    } finally {
      this.saving = false;
    }
  }
}
