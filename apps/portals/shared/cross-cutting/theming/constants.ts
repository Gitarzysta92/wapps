import { InjectionToken } from '@angular/core';
import { IThemingCfg, IThemingProvider } from './theming.interface';


export const THEME_PROVIDER_TOKEN = new InjectionToken<IThemingProvider>('THEME_PROVIDER_TOKEN');
export const THEME_PROVIDER_CFG_TOKEN = new InjectionToken<IThemingCfg>('THEME_PROVIDER_CFG');