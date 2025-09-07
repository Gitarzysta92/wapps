import { inject, Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { AuthenticationStorage } from "../infrastructure/authentication.storage";


@Injectable()
export class AuthenticationService {

  public get token$(): Observable<string | null> { return this._tokenStorage.token$ }
  

  private readonly _tokenStorage = inject(AuthenticationStorage);
  private readonly _authenticationProvider = inject(AUTHENTICATION_PROVIDER);

  public isAuthenticated$ = this._tokenStorage.token$.pipe(map(t => !!t))

  public isAuthenticated(): boolean {
    return !!this._tokenStorage.getToken();
  }

  public authenticate(c: CredentialsDto): Observable<Result<string | null, Error>> {
    return this._authenticationProvider.authenticate(c)
      .pipe(tap(r => {
        if (r.value) {
          this._tokenStorage.setToken(r.value);
        }
      }))
  }

  public unauthenticate(): void {
    this._tokenStorage.clear();
  }
}