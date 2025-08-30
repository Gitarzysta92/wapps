import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { PlatformDto } from "../models/platform.dto";

export const PLATFORMS_PROVIDER = new InjectionToken<IPlatformsProvider>('PLATFORMS_PROVIDER_PORT');

export interface IPlatformsProvider {
  getPlatforms(): Observable<Result<PlatformDto[], Error>>;
}

