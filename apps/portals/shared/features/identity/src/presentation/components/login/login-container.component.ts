import { Component, inject, OnInit } from "@angular/core";
import { LoginFormComponent } from "@ui/login";
import { AsyncPipe } from "@angular/common";
import { 
  CredentialsDto, 
  AuthenticationProvider, 
  AuthenticationMethodDto 
} from "@domains/identity/authentication";
import { TuiButton, TuiLoader, TuiNotification } from "@taiga-ui/core";
import { TimedQueue } from "@primitives";
import { WA_WINDOW } from "@ng-web-apis/common";
import { AuthenticationService } from "../../../application/authentication.service";
import { ProviderButtonsComponent } from "./provider-buttons.component";
import { Observable } from "rxjs";


@Component({
  selector: "login-container",
  templateUrl: "login-container.component.html",
  styleUrl: "login-container.component.scss",
  imports: [
    LoginFormComponent,
    ProviderButtonsComponent,
    TuiNotification,
    TuiButton,
    TuiLoader,
    AsyncPipe
  ]
})
export class LoginContainerComponent implements OnInit {
  private readonly window = inject(WA_WINDOW);
  public readonly timedQueue = new TimedQueue<{ text: string }>(this.window);
  public readonly service = inject(AuthenticationService);
  
  public isAuthenticating = false;
  public authenticatingProvider: AuthenticationProvider | null = null;
  public availableMethods$: Observable<AuthenticationMethodDto[]> | undefined;
  public showEmailPasswordForm = false;
  
  // Expose enum to template
  public readonly AuthenticationProvider = AuthenticationProvider;

  ngOnInit(): void {
    this.availableMethods$ = this.service.getAvailableMethods();
    
    // Check if email/password is enabled
    this.availableMethods$.subscribe(methods => {
      this.showEmailPasswordForm = methods.some(
        m => m.provider === AuthenticationProvider.EMAIL_PASSWORD && m.enabled
      );
    });
  }

  public authenticate(c: CredentialsDto) {
    console.log('authenticate', c);
    if (this.isAuthenticating) {
      return;
    }
    this.isAuthenticating = true;
    this.authenticatingProvider = AuthenticationProvider.EMAIL_PASSWORD;
    
    this.service.authenticate(c).subscribe({
      next: v => {
        if (!v.ok) {
          this.timedQueue.enqueue(this._createExpectedErrorNotification(v.error), 3000);
        }
      },
      error: e => this.timedQueue.enqueue(this._createUnexpectedErrorNotification(e), 3000),
      complete: () => {
        this.isAuthenticating = false;
        this.authenticatingProvider = null;
      }
    });
  }

  public authenticateWithProvider(provider: AuthenticationProvider) {
    console.log('authenticateWithProvider', provider);
    if (this.isAuthenticating) {
      return;
    }
    this.isAuthenticating = true;
    this.authenticatingProvider = provider;
    
    this.service.authenticateWithProvider(provider).subscribe({
      next: v => {
        if (!v.ok) {
          // Only show error if it's not a user cancellation
          const errorMessage = v.error.message;
          if (!errorMessage.includes('cancelled') && !errorMessage.includes('Cancelled')) {
            this.timedQueue.enqueue(this._createExpectedErrorNotification(v.error), 3000);
          }
        }
      },
      error: e => this.timedQueue.enqueue(this._createUnexpectedErrorNotification(e), 3000),
      complete: () => {
        this.isAuthenticating = false;
        this.authenticatingProvider = null;
      }
    });
  }

  private _createExpectedErrorNotification(e: Error): { text: string } {
    return {
      text: e.message
    };
  }

  private _createUnexpectedErrorNotification(e: Error): { text: string } {
    return {
      text: e.message
    };
  }
}
