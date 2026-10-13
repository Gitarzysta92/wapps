import { Observable } from "rxjs";
import { Result } from '@sdk/kernel/standard';
import { ResetPasswordInput } from '../credential-password-reset';

export interface IPasswordResetHandler {
  verifyCode(code: string): Observable<Result<void, Error>>;
  resetPassword(input: ResetPasswordInput): Observable<Result<boolean, Error>>;
}
