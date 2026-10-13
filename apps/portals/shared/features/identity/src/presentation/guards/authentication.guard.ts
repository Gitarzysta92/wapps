import { Injectable, inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { AUTHENTICATION_SESSION } from '../../application/authentication-session.port';

@Injectable()
export class AuthenticationGuard {
  private readonly _storage = inject(AUTHENTICATION_SESSION);
  private readonly _router = inject(Router);

  canActivate(): boolean | UrlTree {
    if (this._storage.getToken()) {
      return true;
    }
    return this._router.createUrlTree(['']);
  }
}
