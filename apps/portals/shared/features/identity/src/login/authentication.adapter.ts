import { Injectable } from '@angular/core';
import { AUTHENTICATION_HANDLER, IAuthenticationHandler, CredentialsDto } from '@domains/identity';
import { Result } from '@standard';
import { Observable, of } from 'rxjs';

@Injectable()
export class AuthenticationAdapter implements IAuthenticationHandler {
  authenticate(credentials: CredentialsDto): Observable<Result<boolean, Error>> {
    // TODO: Implement actual authentication logic
    return of(Result.ok(true));
  }
}
