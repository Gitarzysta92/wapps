import { inject, Injectable } from "@angular/core";
import { WA_LOCAL_STORAGE, WA_WINDOW } from '@ng-web-apis/common';
import { BehaviorSubject, Observable } from "rxjs";


@Injectable()
export class AuthenticationStorage {

  public get token$(): Observable<string | null> { return this._token$ }

  private readonly _localStorage = inject(WA_LOCAL_STORAGE);
  private readonly _window = inject(WA_WINDOW);
  private readonly _authTokenKey = '_i';
  private readonly _token$ = new BehaviorSubject(this._localStorage.getItem(this._authTokenKey))

  constructor() {
    // Keep auth state in sync across tabs/windows (OAuth may complete in a separate tab)
    this._window.addEventListener('storage', (e: StorageEvent) => {
      if (e.storageArea !== this._localStorage) return;
      if (e.key !== this._authTokenKey) return;
      this._token$.next(e.newValue);
    });
  }

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