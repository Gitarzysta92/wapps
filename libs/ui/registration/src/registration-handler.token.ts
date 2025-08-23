import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { RegistrationDto } from './registration.dto';

export interface RegistrationHandlerPort {
  register(registrationData: RegistrationDto): Observable<{ error?: Error }>;
}

export const REGISTRATION_HANDLER = new InjectionToken<RegistrationHandlerPort>('REGISTRATION_HANDLER');
