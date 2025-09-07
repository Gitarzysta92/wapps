import { inject, Injectable } from "@angular/core";
import { WA_LOCAL_STORAGE } from '@ng-web-apis/common';
import { BehaviorSubject, Observable } from "rxjs";


@Injectable()
export class AuthenticationStorage {

  public get token$(): Observable<string | null> { return this._token$ }

  private readonly _localStorage = inject(WA_LOCAL_STORAGE);
  private readonly _authTokenKey = '_i';
  private readonly _token$ = new BehaviorSubject(this._localStorage.getItem(this._authTokenKey))

  public setToken(i: string) {
    this._token$.next(i);
    this._localStorage.setItem(this._authTokenKey, i);
  }

  public clear(): void {
    this._token$.next(null);
    this._localStorage.removeItem(this._authTokenKey);
  }

  public getToken(): string | null {
    return this._token$.value;
  }

}