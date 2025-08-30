import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RegistrationDto } from './registration.dto';
import { Result } from '@standard';

export interface IRegistrationHandler {
  register(registrationData: RegistrationDto): Observable<Result<boolean, Error>>;
}

export const REGISTRATION_HANDLER = new InjectionToken<IRegistrationHandler>('REGISTRATION_HANDLER');
