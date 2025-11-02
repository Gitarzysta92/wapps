import { Component, inject, output } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { TuiTextfield, TuiTextfieldComponent, TuiTextfieldOptionsDirective } from "@taiga-ui/core";
import { InputValidationComponent } from "@ui/form";
import { TuiHint, TuiIcon } from "@taiga-ui/core";
import { NgIf, NgTemplateOutlet } from "@angular/common";
import { PasswordResetRequestFormDto } from "../password-reset-request-form.dto";
import { VALIDATION_MESSAGES } from "../validation-messages.port";

@Component({
  selector: "password-reset-request-form",
  templateUrl: "password-reset-request-form.component.html",
  styleUrl: "password-reset-request-form.component.scss",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfieldComponent,
    TuiIcon,
    TuiHint,
    TuiTextfield,
    InputValidationComponent,
    TuiTextfieldOptionsDirective,
    NgTemplateOutlet,
    NgIf
  ]
})
export class PasswordResetRequestForm {

  public onSubmit = output<PasswordResetRequestFormDto>();

  public get valid() { return this.resetRequestForm.valid }

  public readonly validationMessages = inject(VALIDATION_MESSAGES);
  
  public readonly resetRequestForm = new FormGroup({
    email: new FormControl('', [
      Validators.required,
      Validators.pattern('^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$')
    ]),
  });

  public submitForm(): void {
    if (this.resetRequestForm.valid) {
      this.onSubmit.emit(this.resetRequestForm.getRawValue() as any);
    }
  }

}