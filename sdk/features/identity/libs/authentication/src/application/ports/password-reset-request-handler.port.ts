import { Observable } from "rxjs";
import { PasswordResetRequestDto } from "../models/password-reset-request.dto";
import { Result } from "@foundation/standard";

export interface IPasswordResetRequestHandler {
  requestPasswordReset(r: PasswordResetRequestDto): Observable<Result<void, Error>>
}