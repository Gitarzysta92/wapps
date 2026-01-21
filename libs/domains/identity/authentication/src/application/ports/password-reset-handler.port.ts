import { Observable } from "rxjs";
import { Result } from "@foundation/standard";

export interface IPasswordResetHandler {
  resetPassword(key: string): Observable<Result<boolean, Error>>
}