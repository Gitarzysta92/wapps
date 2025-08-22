import { Component, output } from "@angular/core";
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { NgIf, NgFor } from '@angular/common';
import { TuiInputModule } from "@taiga-ui/legacy";
import { CredentialsDto } from "../../application/models";


@Component({
  selector: "login-form",
  templateUrl: "login-form.component.html",
  styleUrl: "login-form.component.scss",
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    TuiInputModule,
  ]
})
export class LoginFormComponent {

  public onSubmit = output<CredentialsDto>();

  public get valid() { return this.loginForm.valid }

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

  public readonly validationMessages = {
    'email': [
      { type: 'required', message: 'Email jest wymagany.' },
      { type: 'pattern', message: 'Wprowadź poprawny adres email.' }
    ],
    'password': [
      { type: 'required', message: 'Hasło jest wymagane.' },
      { type: 'minlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' }
    ]
  };

  public submitForm(): void {
    if (this.loginForm.valid) {
      this.onSubmit.emit(this.loginForm.getRawValue() as any);
    }
  }

}
