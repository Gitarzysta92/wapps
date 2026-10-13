import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AUTHENTICATION_SESSION } from './authentication-session.port';
import {
  CredentialsDto,
  AuthenticationProvider,
  AuthenticationMethodDto,
} from '@sdk/features/identity/libs/authentication';
import { Result } from '@sdk/kernel/standard';
import { map, tap } from 'rxjs';
import { AUTHENTICATION_HANDLER } from './authentication-handler.token';

@Injectable()
export class AuthenticationService {
  public get token$(): Observable<string | null> {
    return this._tokenStorage.token$;
  }

  private readonly _tokenStorage = inject(AUTHENTICATION_SESSION);
  private readonly _authenticationHandler = inject(AUTHENTICATION_HANDLER);

  public isAuthenticated$ = this._tokenStorage.token$.pipe(map((t) => !!t));

  public isAuthenticated(): boolean {
    return !!this._tokenStorage.getToken();
  }

  public authenticate(
    c: CredentialsDto
  ): Observable<Result<string | null, Error>> {
    return this._authenticationHandler.authenticate(c).pipe(
      tap((r) => {
        if (r.ok) {
          this._tokenStorage.setToken(r.value);
        }
      })
    );
  }

  public authenticateWithProvider(
    provider: AuthenticationProvider
  ): Observable<Result<string | null, Error>> {
    return this._authenticationHandler.authenticateWithProvider(provider).pipe(
      tap((r) => {
        if (r.ok) {
          this._tokenStorage.setToken(r.value);
        }
      })
    );
  }

  public getAvailableMethods(): Observable<AuthenticationMethodDto[]> {
    return this._authenticationHandler.getAvailableMethods();
  }

  public unauthenticate(): void {
    const token = this._tokenStorage.getToken();
    const clearCurrent = () => {
      if (this._tokenStorage.getToken() === token) this._tokenStorage.clear();
    };
    const signOut = this._authenticationHandler.signOut?.();
    if (signOut)
      signOut.subscribe({
        next: clearCurrent,
        error: clearCurrent,
      });
    clearCurrent();
  }
}
