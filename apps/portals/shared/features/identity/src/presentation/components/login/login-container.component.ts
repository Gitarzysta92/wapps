import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoginFormComponent } from '@ui/login';
import { AsyncPipe } from '@angular/common';
import {
  CredentialsDto,
  AuthenticationProvider,
  AuthenticationMethodDto,
} from '@sdk/features/identity/libs/authentication';
import { TuiButton, TuiLoader, TuiNotification } from '@taiga-ui/core';
import { AuthenticationService } from '../../../application/authentication.service';
import { ProviderButtonsComponent } from './provider-buttons.component';
import {
  Observable,
  catchError,
  defer,
  finalize,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import { Result } from '@sdk/kernel/standard';

@Component({
  selector: 'login-container',
  templateUrl: 'login-container.component.html',
  styleUrl: 'login-container.component.scss',
  imports: [
    LoginFormComponent,
    ProviderButtonsComponent,
    TuiNotification,
    TuiButton,
    TuiLoader,
    AsyncPipe,
  ],
})
export class LoginContainerComponent implements OnInit {
  public readonly service = inject(AuthenticationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(ChangeDetectorRef);
  public isAuthenticating = false;
  public authenticatingProvider: AuthenticationProvider | null = null;
  public availableMethods$: Observable<AuthenticationMethodDto[]> | undefined;
  public showEmailPasswordForm = false;
  public loadingMethods = true;
  public methodsError: string | null = null;
  public error: string | null = null;
  public readonly AuthenticationProvider = AuthenticationProvider;

  ngOnInit(): void {
    this.loadMethods();
  }

  loadMethods(): void {
    this.loadingMethods = true;
    this.methodsError = null;
    this.showEmailPasswordForm = false;
    this.availableMethods$ = defer(() =>
      this.service.getAvailableMethods()
    ).pipe(
      tap((methods) => {
        this.showEmailPasswordForm = methods.some(
          (m) =>
            m.provider === AuthenticationProvider.EMAIL_PASSWORD && m.enabled
        );
        if (!methods.some((m) => m.enabled))
          this.methodsError = 'No sign-in methods are currently available.';
        this.changes.markForCheck();
      }),
      catchError(() => {
        this.methodsError = 'Sign-in is unavailable. Please retry.';
        this.changes.markForCheck();
        return of([]);
      }),
      finalize(() => {
        this.loadingMethods = false;
        this.changes.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  hasAlternativeMethods(methods: AuthenticationMethodDto[]): boolean {
    return methods.some(
      (method) =>
        method.enabled &&
        method.provider !== AuthenticationProvider.EMAIL_PASSWORD
    );
  }

  authenticate(credentials: CredentialsDto): void {
    this.run(AuthenticationProvider.EMAIL_PASSWORD, () =>
      this.service.authenticate(credentials)
    );
  }

  authenticateWithProvider(provider: AuthenticationProvider): void {
    this.run(provider, () => this.service.authenticateWithProvider(provider));
  }

  private run(
    provider: AuthenticationProvider,
    command: () => Observable<Result<string | null, Error>>
  ): void {
    if (this.isAuthenticating) return;
    this.isAuthenticating = true;
    this.authenticatingProvider = provider;
    this.error = null;
    defer(command)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isAuthenticating = false;
          this.authenticatingProvider = null;
          this.changes.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          if (!result.ok) this.error = result.error.message;
          this.changes.markForCheck();
        },
        error: () => {
          this.error = 'Sign-in could not be completed. Please try again.';
          this.changes.markForCheck();
        },
      });
  }
}
