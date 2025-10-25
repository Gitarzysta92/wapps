import { ValidationMessages as RegistrationValidationMessages } from "@ui/registration";
import { ValidationMessages as PasswordResetValidationMessages } from "@ui/password-reset";

export const PASSWORD_RESET_VALIDATION_MESSAGES: PasswordResetValidationMessages = {
  email: [
    { type: "required", message: 'Email is required' },
    { type: "pattern", message: 'Please enter a valid email address' }
  ]
};

export const REGISTRATION_VALIDATION_MESSAGES: RegistrationValidationMessages = {
  nickname: [
    {type: "required", message: 'Nickname is required' },
    {type: "minlength", message: 'Nickname must be at least 5 characters long' },
    {type: "maxlength", message: 'Nickname cannot exceed 35 characters' }
  ],
  email: [
    {type: "required", message: 'Email is required' },
    {type: "pattern", message: 'Please enter a valid email address' }
  ],
  password: [
    {type: "required", message: 'Password is required' },
    {type: "minlength", message: 'Password must be at least 5 characters long' },
    {type: "maxlength", message: 'Password cannot exceed 35 characters' }
  ],
  passwordConfirmation: [
    {type: "required", message: 'Password confirmation is required' },
    {type: "minlength", message: 'Password confirmation must be at least 5 characters long' },
    {type: "maxlength", message: 'Password confirmation cannot exceed 35 characters' }
  ]
};

export const LOGIN_VALIDATION_MESSAGES = {
  'email': [
    { type: 'required', message: 'Email jest wymagany.' },
    { type: 'pattern', message: 'Wprowadź poprawny adres email.' }
  ],
  'password': [
    { type: 'required', message: 'Hasło jest wymagane.' },
    { type: 'minlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' }
  ]
};
