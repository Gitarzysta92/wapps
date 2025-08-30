import { Observable } from 'rxjs';

export interface IThemingProvider {
  theme$: Observable<string>;
  isToggled$: Observable<boolean>;
  toggle(): void;
}

export interface IThemingCfg {
  darkThemeName: string;
  lightThemeName: string;
  attributeName: string;
}
