import { Component, inject } from "@angular/core";
import { LoginFormComponent } from "../login-form/login-form.component";
import { AUTHENTICATION_HANDLER } from "../../../../../../../../libs/domains/identity/authentication/login/application/ports";
import { CredentialsDto } from "../../../../../../../../libs/domains/identity/authentication/login/application/models";
import { TuiButton, TuiLoader, TuiNotification } from "@taiga-ui/core";
import { TimeoutQueue } from "../../../../../utils/timeout-queue";


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
  public readonly timeoutQueue = new TimeoutQueue<{ id: number, text: string }>()
  public readonly service = inject(AUTHENTICATION_HANDLER);
  public isAuthenticating: boolean = false;

  public authenticate(c: CredentialsDto) {
    if (this.isAuthenticating) {
      return
    }
    this.isAuthenticating = true;
    this.service.authenticate(c).subscribe({
      next: v => !!v.error && this.timeoutQueue.enqueue(this._createExpectedErrorNotification(v.error), 2000),
      error: e => this.timeoutQueue.enqueue(this._createUnexpectedErrorNotification(e), 2000),
      complete: () => this.isAuthenticating = false
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
