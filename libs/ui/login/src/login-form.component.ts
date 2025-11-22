import { Component, inject, output } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { NgIf, NgFor } from '@angular/common';
import { LoginFormDto } from "./login-form.dto";
import { VALIDATION_MESSAGES } from "./validation-messages.port";
import { TuiIcon, TuiTextfield } from "@taiga-ui/core";



@Component({
  selector: "login-form",
  templateUrl: "login-form.component.html",
  styleUrl: "login-form.component.scss",
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    TuiTextfield,
    TuiIcon
]
})
export class LoginFormComponent {

  public onSubmit = output<LoginFormDto>();

  public get valid() { return this.loginForm.valid }

  public readonly validationMessages = inject(VALIDATION_MESSAGES);

  public readonly loginForm = new FormGroup({
    login: new FormControl('', [
      Validators.required,
      Validators.pattern('^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$')
    ]),
    password: new FormControl('', [
      Validators.minLength(5),
      Validators.required
    ])
  });


  public submitForm(): void {
    if (this.loginForm.valid) {
      this.onSubmit.emit(this.loginForm.getRawValue() as any);
    }
  }

}
