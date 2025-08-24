import { inject, Injectable } from "@angular/core";
import { CredentialsDto } from "../../../../../../../libs/features/identity/login/application/models";
import { Result } from "@standard";
import { AuthenticationService } from "../../../../aspects/authentication/application/services/authentication.service";
import { map, Observable } from "rxjs";
import { IAuthenticationHandler } from "../../../../../../../libs/features/identity/login/application/ports";

@Injectable()
export class AuthenticationAdapter implements IAuthenticationHandler {

  private readonly _authenticationService = inject(AuthenticationService);

  public authenticate(c: CredentialsDto): Observable<Result<boolean, Error>> {
    return this._authenticationService.authenticate(c)
      .pipe(map(r => Object.assign({ ...r }, { value: !!r.value })))
  }

}