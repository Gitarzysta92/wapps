import { Observable } from 'rxjs';

export interface IThemingProvider {
  theme$: Observable<string>;
  isToggled$: Observable<boolean>;
  error$?: Observable<string | null>;
  toggle(): void | Promise<void>;
}

export interface IThemingCfg {
  darkThemeName: string;
  lightThemeName: string;
  attributeName: string;
}
