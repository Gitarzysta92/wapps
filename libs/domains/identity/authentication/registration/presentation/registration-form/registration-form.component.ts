import { Component, inject, output } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { TuiInputModule, TuiTextfieldControllerModule } from "@taiga-ui/legacy";
import { RegistrationDto } from "../../application/models";
import { VALIDATION_MESSAGES } from "../ports/validation-messages.port";
import { InputValidationComponent } from "../../../../../ui/components/form/input-validation/input-validation.component";
import { matchFieldsValidator } from "../../application";
import { TuiHint, TuiIcon, TuiTextfieldComponent } from "@taiga-ui/core";



@Component({
  selector: "registration-form",
  templateUrl: "registration-form.component.html",
  styleUrl: "registration-form.component.scss",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiInputModule,
    TuiIcon,
    TuiHint,
    InputValidationComponent,
    TuiTextfieldControllerModule
  ]
})
export class RegistrationFormComponent {

  public onSubmit = output<RegistrationDto>();

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
  }, { validators: matchFieldsValidator('password', 'passwordConfirmation') });

  public submitForm(): void {
    if (this.registrationForm.valid) {
      this.onSubmit.emit(this.registrationForm.getRawValue() as any);
    }
  }

}
