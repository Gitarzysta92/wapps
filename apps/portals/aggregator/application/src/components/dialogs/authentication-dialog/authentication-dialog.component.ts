import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { TuiLink } from "@taiga-ui/core";
import { RoutedDialogButton } from "../../../../../libs/ui/directives/identity-routed-dialog-button.directive";
import { LoginContainerComponent } from "../../../../../libs/features/identity/login/presentation/login-container";
import { AuthenticationService } from "../../../../../libs/aspects/authentication/application";
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
  private readonly _service = inject(AuthenticationService);
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