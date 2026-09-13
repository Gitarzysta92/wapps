import { Injectable, inject } from "@angular/core";
import { Router, UrlTree } from "@angular/router";
import { AuthenticationStorage } from "../../infrastructure/authentication.storage";


@Injectable()
export class AuthenticationGuard {
  private readonly _storage = inject(AuthenticationStorage);
  private readonly _router = inject(Router);

  canActivate(): boolean | UrlTree {
    if (this._storage.getToken()) {
      return true;
    }
    return this._router.createUrlTree(['']);
  }
}