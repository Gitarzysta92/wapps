import { InjectionToken } from "@angular/core";

export const ENVIRONMENT_TYPE = new InjectionToken<IEnvironmentType>('ENVIRONMENT_TYPE');

export interface IEnvironmentType {
  isProduction: boolean;
  isDevelopment: boolean;
} 