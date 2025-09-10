import { Component, inject } from "@angular/core";
import { TuiNotification, TuiButton, TuiLoader } from "@taiga-ui/core";
import { WA_WINDOW } from '@ng-web-apis/common';
import { TimedQueue } from "../../../../primitives/src/timed-queue";
import { RegistrationFormComponent } from "../registration-form/registration-form.component";
import { RegistrationDto } from "../registration.dto";
import { REGISTRATION_HANDLER } from "../registration-handler.token";


@Component({
  selector: "registration-container",
  templateUrl: "./registration-container.component.html",
  imports: [
    RegistrationFormComponent,
    TuiNotification,
    TuiButton,
    TuiLoader
  ]
})
export class RegistrationContainerComponent {
  public readonly service = inject(REGISTRATION_HANDLER);
  public readonly window = inject(WA_WINDOW);
  public readonly timeoutQueue = new TimedQueue<{ text: string }>(window)
  public isRegistering: boolean = false;

  public register(c: RegistrationDto): void {
    if (this.isRegistering) {
      return
    }
    this.isRegistering = true;
    this.service.register(c).subscribe({
      next: v => !v.ok && this.timeoutQueue.enqueue(this._createExpectedErrorNotification(v.error), 2000),
      error: e => this.timeoutQueue.enqueue(this._createUnexpectedErrorNotification(e), 2000),
      complete: () => this.isRegistering = false
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