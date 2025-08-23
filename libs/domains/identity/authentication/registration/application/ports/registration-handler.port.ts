import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "../../../../../utils/utility-types";
import { RegistrationDto } from "../models";


export const REGISTRATION_HANDLER = new InjectionToken<IRegistrationHandler>('REGISTRATION_HANDLER');

export interface IRegistrationHandler {
  register(r: RegistrationDto): Observable<Result<boolean, Error>>
}