import { Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { Result } from "@standard";
import { IPasswordResetRequestHandler, ResetRequestDto } from "@features/identity";



@Injectable()
export class PasswordResetRequestApiService implements IPasswordResetRequestHandler {
  requestPasswordReset(r: ResetRequestDto): Observable<Result<void, Error>> {
    return of({ 
      ok: true as const,
      value: undefined
    }).pipe(delay(2000))
  }
}