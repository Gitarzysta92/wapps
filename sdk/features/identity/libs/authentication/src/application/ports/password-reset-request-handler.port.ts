import { Observable } from "rxjs";
import { PasswordResetRequestDto } from "../models/password-reset-request.dto";
import { Result } from "@sdk/kernel/standard";

export interface IPasswordResetRequestHandler {
  requestPasswordReset(r: PasswordResetRequestDto): Observable<Result<void, Error>>
}