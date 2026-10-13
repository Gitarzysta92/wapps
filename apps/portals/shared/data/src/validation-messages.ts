import { ValidationMessagesVM as RegistrationValidationMessages } from '@ui/registration';
import { ValidationMessages as PasswordResetValidationMessages } from '@ui/password-reset';

export const PASSWORD_RESET_VALIDATION_MESSAGES: PasswordResetValidationMessages =
  {
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'pattern', message: 'Please enter a valid email address' },
    ],
  };

export const REGISTRATION_VALIDATION_MESSAGES: RegistrationValidationMessages =
  {
    nickname: [
      { type: 'required', message: 'Nickname is required' },
      { type: 'minlength', message: 'Nickname is required' },
      { type: 'maxlength', message: 'Nickname cannot exceed 120 characters' },
      {
        type: 'pattern',
        message: 'Remove surrounding spaces from your nickname',
      },
    ],
    email: [
      { type: 'required', message: 'Email is required' },
      { type: 'email', message: 'Please enter a valid email address' },
      { type: 'maxlength', message: 'Email cannot exceed 254 characters' },
    ],
    password: [
      { type: 'required', message: 'Password is required' },
      {
        type: 'minlength',
        message: 'Password must be at least 6 characters long',
      },
      { type: 'maxlength', message: 'Password cannot exceed 128 characters' },
    ],
    passwordConfirmation: [
      { type: 'required', message: 'Password confirmation is required' },
      {
        type: 'minlength',
        message: 'Password confirmation must be at least 6 characters long',
      },
      {
        type: 'maxlength',
        message: 'Password confirmation cannot exceed 128 characters',
      },
      { type: 'fieldsMismatch', message: 'Passwords must match' },
    ],
  };

export const LOGIN_VALIDATION_MESSAGES = {
  email: [
    { type: 'required', message: 'Email jest wymagany.' },
    { type: 'pattern', message: 'Wprowadź poprawny adres email.' },
  ],
  password: [
    { type: 'required', message: 'Hasło jest wymagane.' },
    { type: 'minlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' },
  ],
};
