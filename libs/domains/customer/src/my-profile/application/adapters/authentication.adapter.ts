import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { IAuthenticationProvider } from "../ports/authentication-provider.port";

@Injectable()
export class AuthenticationAdapter implements IAuthenticationProvider {
  private readonly _isAuthenticated$ = new BehaviorSubject<boolean>(false);

  public get isAuthenticated$(): Observable<boolean> {
    return this._isAuthenticated$.asObservable();
  }

  public setAuthenticated(isAuthenticated: boolean): void {
    this._isAuthenticated$.next(isAuthenticated);
  }
}
