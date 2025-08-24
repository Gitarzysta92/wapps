import { InjectionToken } from "@angular/core";
import { CredentialsDto } from "../models/credentials.dto";
import { Result } from "@standard";
import { Observable } from "rxjs";

export const AUTHENTICATION_HANDLER = new InjectionToken<IAuthenticationHandler>('AUTHENTICATION_HANDLER_PORT');

export interface IAuthenticationHandler {
  authenticate(c: CredentialsDto): Observable<Result<boolean, Error>>;
}