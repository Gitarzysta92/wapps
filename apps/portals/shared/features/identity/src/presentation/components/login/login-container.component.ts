import { Component, inject } from "@angular/core";
import { LoginFormComponent } from "@ui/login";
import { CredentialsDto } from "@domains/identity/authentication";
import { TuiButton, TuiLoader, TuiNotification } from "@taiga-ui/core";
import { TimedQueue } from "@primitives";
import { WA_WINDOW } from "@ng-web-apis/common";
import { AuthenticationService } from "../../../application/authentication.service";


@Component({
  selector: "login-container",
  templateUrl: "login-container.component.html",
  styleUrl: "login-container.component.scss",
  imports: [
    LoginFormComponent,
    TuiNotification,
    TuiButton,
    TuiLoader
  ]
})
export class LoginContainerComponent {
  private readonly window = inject(WA_WINDOW);
  public readonly timedQueue = new TimedQueue<{ text: string }>(this.window);
  public readonly service = inject(AuthenticationService);
  public isAuthenticating = false;

  public authenticate(c: CredentialsDto) {
    if (this.isAuthenticating) {
      return
    }
    this.isAuthenticating = true;
    this.service.authenticate(c).subscribe({
      next: v => !v.ok && this.timedQueue.enqueue(this._createExpectedErrorNotification(v.error), 2000),
      error: e => this.timedQueue.enqueue(this._createUnexpectedErrorNotification(e), 2000),
      complete: () => { this.isAuthenticating = false }
    })
  }

  private _createExpectedErrorNotification(e: Error): { text: string } {
    return {
      text: e.message
    }
  }

  private _createUnexpectedErrorNotification(e: Error): { text: string } {
    return {
      text: e.message
    }
  }
}
