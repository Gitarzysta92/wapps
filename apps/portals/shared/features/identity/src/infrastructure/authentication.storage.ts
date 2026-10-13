import { inject, Injectable } from '@angular/core';
import { WA_LOCAL_STORAGE, WA_WINDOW } from '@ng-web-apis/common';
import { BehaviorSubject, Observable } from 'rxjs';
import type { AuthenticationSession } from '../application/authentication-session.port';

@Injectable()
export class AuthenticationStorage implements AuthenticationSession {
  public get token$(): Observable<string | null> {
    return this._token$;
  }

  private readonly _localStorage = inject(WA_LOCAL_STORAGE);
  private readonly _window = inject(WA_WINDOW);
  private readonly _authTokenKey = '_i';
  private readonly _token$ = new BehaviorSubject(this.read(this._authTokenKey));

  constructor() {
    // Keep auth state in sync across tabs/windows (OAuth may complete in a separate tab)
    this._window.addEventListener('storage', (e: StorageEvent) => {
      if (e.storageArea !== this._localStorage) return;
      if (e.key !== this._authTokenKey) return;
      this._token$.next(e.newValue);
    });
  }

  public setToken(i: string) {
    this._localStorage.setItem(this._authTokenKey, i);
    this._token$.next(i);
  }

  public getRefreshToken(): string | null {
    return this.read('auth_refresh_token');
  }

  public setRefreshToken(token: string): void {
    this._localStorage.setItem('auth_refresh_token', token);
  }

  public clearRefreshToken(): void {
    this._localStorage.removeItem('auth_refresh_token');
  }

  public clear(): void {
    this._token$.next(null);
    this._localStorage.removeItem(this._authTokenKey);
    this._localStorage.removeItem('auth_refresh_token');
  }

  public getToken(): string | null {
    return this._token$.value;
  }

  private read(key: string): string | null {
    try {
      return this._localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}
