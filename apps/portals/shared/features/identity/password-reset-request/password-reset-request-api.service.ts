import { Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { Result } from "../../../../utils/utility-types";
import { IPasswordResetRequestHandler } from "../../../../../../libs/features/identity/password-reset-request/application/ports";
import { ResetRequestDto } from "../../../../../../libs/features/identity/password-reset-request/application/models";


@Injectable()
export class PasswordResetRequestApiService implements IPasswordResetRequestHandler {
  requestPasswordReset(r: ResetRequestDto): Observable<Result<boolean, Error>> {
    return of({
      value: true
    }).pipe(delay(2000))
  }
}