import { Directive, ElementRef, Renderer2, OnDestroy, inject, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { THEME_PROVIDER_CFG_TOKEN, THEME_PROVIDER_TOKEN } from './constants';

@Directive({
  selector: '[themingDescriptor]',
  standalone: true,
})
export class ThemingDescriptorDirective implements OnDestroy, OnInit {

  private readonly _themeProvider = inject(THEME_PROVIDER_TOKEN);
  private readonly _themeCfg = inject(THEME_PROVIDER_CFG_TOKEN);
  private readonly _renderer = inject(Renderer2);
  private readonly _el = inject(ElementRef);
  private _s: Subscription | undefined;

  ngOnInit(): void {
    this._s = this._themeProvider.theme$.subscribe(t => {
      this._renderer.setAttribute(this._el.nativeElement, this._themeCfg.attributeName, t);

      const themeToRemove = t === this._themeCfg.darkThemeName ? this._themeCfg.lightThemeName : this._themeCfg.darkThemeName;
      this._renderer.removeClass(this._el.nativeElement, themeToRemove);
      this._renderer.addClass(this._el.nativeElement, t);
    });
  }

  ngOnDestroy(): void {
    this._s?.unsubscribe();
  }
}