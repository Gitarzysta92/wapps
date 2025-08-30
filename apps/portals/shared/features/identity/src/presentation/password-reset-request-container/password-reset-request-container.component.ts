import { NgIf, NgFor } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { TuiButton, TuiLoader, TuiNotification } from "@taiga-ui/core";
import { TuiInputModule } from "@taiga-ui/legacy";
import { PASSWORD_RESET_REQUEST_HANDLER } from "../../../../../../../../libs/domains/identity/authentication/password-reset-request/application/ports";
import { VALIDATION_MESSAGES } from "../../../../../../../../libs/domains/identity/authentication/password-reset-request/presentation/ports/validation-messages.port";
import { ActivatedRoute } from "@angular/router";
import { TimeoutQueue } from "../../../../../utils/timeout-queue";

@Component({
  selector: "password-reset-request-container",
  templateUrl: "password-reset-request-container.component.html",
  styleUrl: "password-reset-request-container.component.scss",
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    TuiInputModule,
    TuiButton,
    TuiLoader,
    TuiNotification,
  ]
})
export class PasswordResetRequestContainer {
  public readonly timeoutQueue = new TimeoutQueue<{ id: number, text: string }>()
  public readonly validationMessages = inject(VALIDATION_MESSAGES);
  private readonly _service = inject(PASSWORD_RESET_REQUEST_HANDLER);
  private readonly _activatedRoute = inject(ActivatedRoute);

  public isProcessing: boolean = false;
  public readonly resetRequestForm = new FormGroup({
    email: new FormControl('', [
      Validators.required,
      Validators.pattern('^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$')
    ]),
  });

  public requestPasswordReset(): void {
    if (this.isProcessing) {
      return
    }
    this.isProcessing = true;
    this._service.requestPasswordReset({
      email: this.resetRequestForm.value.email as string,
      token: this._activatedRoute.snapshot.queryParamMap.get('token') as string }
    ).subscribe({
      next: r => {
        if (r.value) {
          this.timeoutQueue.enqueue(this._createSuccessNotification(), 2000)
        }
      },
      error: e => this.timeoutQueue.enqueue(this._createUnexpectedErrorNotification(e), 2000),
      complete: () => {
        this.isProcessing = false;
        this.resetRequestForm.reset()
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