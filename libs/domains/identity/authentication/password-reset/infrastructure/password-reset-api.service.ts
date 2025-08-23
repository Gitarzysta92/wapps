import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "../../../../utils/utility-types";
import { IPasswordResetHandler } from "../application/ports";

@Injectable()
export class PasswordResetApiService implements IPasswordResetHandler {
  resetPassword(key: string): Observable<Result<boolean, Error>> {
    throw new Error("Method not implemented.");
  }
}