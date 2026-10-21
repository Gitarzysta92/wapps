import { Component, inject, output } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  TuiTextfield,
  TuiTextfieldComponent,
  TuiTextfieldOptionsDirective,
} from '@taiga-ui/core';
import { InputValidationComponent } from '@ui/form';
import { TuiHint, TuiIcon } from '@taiga-ui/core';
import { equalValue } from '../equal-value.form-validator';
import { NgIf, NgTemplateOutlet } from '@angular/common';
import { RegistrationFormDto } from '../registration-form.dto';
import { VALIDATION_MESSAGES } from '../validation-messages.port';
import { TuiPassword } from '@taiga-ui/kit';

@Component({
  selector: 'registration-form',
  templateUrl: 'registration-form.component.html',
  styleUrl: 'registration-form.component.scss',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfieldComponent,
    TuiIcon,
    TuiPassword,
    TuiHint,
    TuiTextfield,
    InputValidationComponent,
    TuiTextfieldOptionsDirective,
    NgTemplateOutlet,
    NgIf,
  ],
})
export class RegistrationFormComponent {
  public onSubmit = output<RegistrationFormDto>();

  public get valid() {
    return this.registrationForm.valid;
  }

  public readonly validationMessages = inject(VALIDATION_MESSAGES);

  public readonly registrationForm = new FormGroup(
    {
      nickname: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(1),
          Validators.maxLength(120),
          Validators.pattern(/^\S(?:[\s\S]*\S)?$/),
        ],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.email,
          Validators.maxLength(254),
        ],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.minLength(6),
          Validators.maxLength(128),
          Validators.required,
        ],
      }),
      passwordConfirmation: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.minLength(6),
          Validators.maxLength(128),
          Validators.required,
        ],
      }),
    },
    { validators: equalValue(['password', 'passwordConfirmation']) }
  );

  public submitForm(): void {
    if (this.registrationForm.valid) {
      this.onSubmit.emit(this.registrationForm.getRawValue());
    }
  }
}
