import { WA_WINDOW } from "@ng-web-apis/common";
import { Component, inject } from "@angular/core";
import { TuiButton, TuiLoader, TuiNotification } from "@taiga-ui/core";
import { TimedQueue } from "@foundation/primitives";
import { PASSWORD_RESET_REQUEST_HANDLER } from "../../../application/password-reset-request-handler.token";
import { PasswordResetRequestForm, PasswordResetRequestFormDto } from "@ui/password-reset";


@Component({
  selector: "password-reset-request-container",
  templateUrl: "password-reset-request-container.component.html",
  styleUrl: "password-reset-request-container.component.scss",
  standalone: true,
  imports: [
    TuiButton,
    TuiLoader,
    TuiNotification,
    PasswordResetRequestForm,
  ]
})
export class PasswordResetRequestContainerComponent {
  private readonly _window = inject(WA_WINDOW);
  public readonly timedQueue = new TimedQueue<{ text: string }>(this._window);
  private readonly _service = inject(PASSWORD_RESET_REQUEST_HANDLER);

  public isProcessing: boolean = false;

  public onFormSubmit(formData: PasswordResetRequestFormDto): void {
    if (this.isProcessing) {
      return
    }
    this.isProcessing = true;
    this._service.requestPasswordReset({
      login: formData.email
    }).subscribe({
      next: r => {
        if (r.ok) {
          this.timedQueue.enqueue(this._createSuccessNotification(), 2000)
        }
      },
      error: e => this.timedQueue.enqueue(this._createUnexpectedErrorNotification(e), 2000),
      complete: () => {
        this.isProcessing = false;
      }
    })
  }

  private _createSuccessNotification(): { text: string } {
    return {
      text: "success"
    }
  }

  private _createUnexpectedErrorNotification(e: Error): { text: string } {
    return {
      text: e.message
    }
  }
}