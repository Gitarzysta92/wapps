import { Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { Result } from "@standard";
import { IPasswordResetRequestHandler, RegistrationDto } from "@domains/identity/authentication";
import { PasswordResetRequestDto } from "@domains/identity/authentication";



@Injectable()
export class PasswordResetRequestApiService implements IPasswordResetRequestHandler {
  register(r: RegistrationDto): Observable<Result<boolean, Error>> {
    throw new Error("Method not implemented.");
  }
  requestPasswordReset(r: PasswordResetRequestDto): Observable<Result<void, Error>> {
    return of({ 
      ok: true as const,
      value: undefined
    }).pipe(delay(2000))
  }
}