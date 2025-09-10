import { Injectable, inject } from "@angular/core";
import { Router, UrlTree } from "@angular/router";
import { IDENTITY_PROVIDER } from "../../application/identity-provider.token";


@Injectable()
export class AuthenticationGuard {
  private readonly _identityProvider = inject(IDENTITY_PROVIDER);
  private readonly _router = inject(Router);

  //TODO: This guard needs to be refactored to use the new identity provider
  canActivate(): boolean | UrlTree {
    if (this._identityProvider.getIdentity()) {
      return true;
    }
    return this._router.createUrlTree(['']);
  }
}