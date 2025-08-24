import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { ResetRequestDto } from "../models/reset-request.dto";


export const PASSWORD_RESET_REQUEST_HANDLER = new InjectionToken<IPasswordResetRequestHandler>('PASSWORD_RESET_REQUEST_HANDLER');

export interface IPasswordResetRequestHandler {
  requestPasswordReset(r: ResetRequestDto): Observable<Result<void, Error>>
}