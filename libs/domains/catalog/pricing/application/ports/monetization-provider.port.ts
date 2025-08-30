import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { MonetizationDto } from "../models/monetization.dto";

export const MONETIZATION_PROVIDER = new InjectionToken<IMonetizationProvider>('MONETIZATION_PROVIDER_PORT');

export interface IMonetizationProvider {
  getMonetizations(): Observable<Result<MonetizationDto[], Error>>;
}

