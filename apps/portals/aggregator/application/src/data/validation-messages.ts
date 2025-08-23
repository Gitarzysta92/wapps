export const VALIDATION_MESSAGES = {
  email: [
    { type: 'required', message: 'Email jest wymagany.' },
    { type: 'pattern', message: 'Wprowadź poprawny adres email.' }
  ],
  password: [
    { type: 'required', message: 'Hasło jest wymagane.' },
    { type: 'minlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' },
    { type: 'maxlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' }
  ],
  passwordConfirmation: [
    { type: 'required', message: 'Password confirmation is required.' },
    { type: 'minlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' },
    { type: 'maxlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' },
    { type: 'fieldsMismatch', message: 'Passwords have to be same.' }
  ],
  nickname: [
    { type: 'required', message: 'Hasło jest wymagane.' },
    { type: 'minlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' },
    { type: 'maxlength', message: 'Hasło musi posiadać conajmniej 5 znaków.' }
  ]
};