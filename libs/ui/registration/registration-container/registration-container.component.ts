import { Component, inject } from "@angular/core";
import { TuiNotification, TuiButton, TuiLoader } from "@taiga-ui/core";
import { REGISTRATION_HANDLER } from "../../application/ports";
import { TimeoutQueue } from "../../../../../utils/timeout-queue";
import { RegistrationDto } from "../../application/models";
import { RegistrationFormComponent } from "../registration-form/registration-form.component";


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
  public readonly timeoutQueue = new TimeoutQueue<{ id: number, text: string }>()
  public readonly service = inject(REGISTRATION_HANDLER);
  public isRegistering: boolean = false;

  public register(c: RegistrationDto): void {
    if (this.isRegistering) {
      return
    }
    this.isRegistering = true;
    this.service.register(c).subscribe({
      next: v => !!v.error && this.timeoutQueue.enqueue(this._createExpectedErrorNotification(v.error), 2000),
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