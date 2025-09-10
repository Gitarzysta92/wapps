import { Component, inject, output } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { TuiTextfieldComponent, TuiTextfieldOptionsDirective } from "@taiga-ui/core";
import { InputValidationComponent } from "@ui/form";
import { TuiHint, TuiIcon } from "@taiga-ui/core";
import { equalValue } from "../equal-value.form-validator";
import { NgIf, NgTemplateOutlet } from "@angular/common";
import { RegistrationFormDto } from "../registration-form.dto";
import { VALIDATION_MESSAGES } from "../validation-messages.port";



@Component({
  selector: "registration-form",
  templateUrl: "registration-form.component.html",
  styleUrl: "registration-form.component.scss",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfieldComponent,
    TuiIcon,
    TuiHint,
    InputValidationComponent,
    TuiTextfieldOptionsDirective,
    NgTemplateOutlet,
    NgIf
  ]
})
export class RegistrationFormComponent {

  public onSubmit = output<RegistrationFormDto>();

  public get valid() { return this.registrationForm.valid }

  public readonly validationMessages = inject(VALIDATION_MESSAGES);
  
  public readonly registrationForm = new FormGroup({
    nickname: new FormControl('', [
      Validators.required,
      Validators.minLength(5),
      Validators.maxLength(35),
    ]),
    email: new FormControl('', [
      Validators.required,
      Validators.pattern('^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$')
    ]),
    password: new FormControl('', [
      Validators.minLength(5),
      Validators.maxLength(35),
      Validators.required
    ]),
    passwordConfirmation: new FormControl('', [
      Validators.minLength(5),
      Validators.maxLength(35),
      Validators.required
    ])
  }, { validators: equalValue(['password', 'passwordConfirmation']) });

  public submitForm(): void {
    if (this.registrationForm.valid) {
      this.onSubmit.emit(this.registrationForm.getRawValue() as any);
    }
  }

}
