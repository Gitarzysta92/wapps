import { NgIf, NgFor } from "@angular/common";
import { WA_WINDOW } from "@ng-web-apis/common";
import { Component, inject } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { TuiButton, TuiLoader, TuiNotification } from "@taiga-ui/core";
import { TuiTextfieldComponent } from "@taiga-ui/core";
import { PASSWORD_RESET_REQUEST_HANDLER } from "../../../../../apps/portals/shared/features/identity/src/application/password-reset-request-handler.token";
import { VALIDATION_MESSAGES, ValidationMessages } from "../validation-messages";
import { ActivatedRoute } from "@angular/router";
import { TimedQueue } from "../../../../primitives/src/timed-queue";

@Component({
  selector: "password-reset-request-container",
  templateUrl: "password-reset-request-container.component.html",
  styleUrl: "password-reset-request-container.component.scss",
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    TuiTextfieldComponent,
    TuiButton,
    TuiLoader,
    TuiNotification,
  ]
})
export class PasswordResetRequestContainer {
  private readonly _window = inject(WA_WINDOW);
  public readonly timeoutQueue = new TimedQueue<{ text: string }>(this._window);
  public readonly validationMessages: ValidationMessages = VALIDATION_MESSAGES;
  private readonly _service = inject(PASSWORD_RESET_REQUEST_HANDLER);
  private readonly _activatedRoute = inject(ActivatedRoute);

  public isProcessing: boolean = false;
  public readonly resetRequestForm = new FormGroup({
    email: new FormControl<string>('', [
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
}