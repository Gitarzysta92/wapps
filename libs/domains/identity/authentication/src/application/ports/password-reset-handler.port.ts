import { Observable } from "rxjs";
import { Result } from "@standard";

export interface IPasswordResetHandler {
  resetPassword(key: string): Observable<Result<boolean, Error>>
}