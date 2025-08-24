import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";


export const PASSWORD_RESET_HANDLER = new InjectionToken<IPasswordResetHandler>('PASSWORD_RESET_HANDLER');

export interface IPasswordResetHandler {
  resetPassword(key: string): Observable<Result<boolean, Error>>
}