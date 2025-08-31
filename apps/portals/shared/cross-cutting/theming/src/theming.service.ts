import { inject, Injectable } from "@angular/core";
import { IThemingProvider } from "./theming.interface";
import { BehaviorSubject, map } from "rxjs";
import { THEME_PROVIDER_CFG_TOKEN } from "./constants";

@Injectable()
export class ThemingService implements IThemingProvider {

  private readonly _cfg = inject(THEME_PROVIDER_CFG_TOKEN);

  public theme$: BehaviorSubject<string> = new BehaviorSubject(this._cfg.lightThemeName);
  public isToggled$ = this.theme$.pipe(map(t => t === this._cfg.lightThemeName));

  public toggle() {
    this.theme$.next(this.theme$.value === this._cfg.lightThemeName ? this._cfg.darkThemeName : this._cfg.lightThemeName)
  }
}