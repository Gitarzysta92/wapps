import { InjectionToken } from "@angular/core";
import { ISharingProvider } from "./sharing-provider.port";

export const SHARING_PROVIDER = new InjectionToken<ISharingProvider>('SHARING_PROVIDER');
