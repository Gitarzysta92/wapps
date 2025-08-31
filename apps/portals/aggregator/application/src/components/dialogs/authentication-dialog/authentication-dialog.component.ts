import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { RoutedDialogButton } from "@ui/routable-dialog";
import { LoginContainerComponent } from "@ui/login";
import { IAuthenticationProvider } from "@domains/customer/my-profile";
import { filter, Subscription } from "rxjs";
import { ActivatedRoute, Router } from "@angular/router";


@Component({
  templateUrl: "authentication-dialog.component.html",
  host: { 'data-component-id': 'auth-dialog' },
  imports: [
    LoginContainerComponent,
    RoutedDialogButton,
    TuiLink
  ]
})
export class AuthenticationDialogComponent implements OnInit, OnDestroy {
  private readonly _service = inject(IAuthenticationProvider);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
  private _s: Subscription | undefined;

  ngOnInit(): void {
    this._s = this._service.isAuthenticated$
      .pipe(filter(Boolean))
      .subscribe(() => this._router.navigate([{
        outlets: { dialog: null },
        relativeTo: this._activatedRoute
      }]))
  }

  ngOnDestroy(): void {
    this._s?.unsubscribe();
  }
  
}