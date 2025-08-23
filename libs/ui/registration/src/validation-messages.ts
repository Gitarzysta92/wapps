export interface ValidationMessages {
  nickname: {
    type: string;
    message: string;
  }[];
  email: {
    type: string;
    message: string;
  }[];
  password: {
    type: string;
    message: string;
  }[];
  passwordConfirmation: {
    type: string;
    message: string;
  }[];
}

export const VALIDATION_MESSAGES: ValidationMessages = {
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
