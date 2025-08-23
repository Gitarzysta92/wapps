export interface ValidationMessages {
  email: {
    type: string;
    message: string;
  }[];
}

export const VALIDATION_MESSAGES: ValidationMessages = {
  email: [
    { type: "required", message: 'Email is required' },
    { type: "pattern", message: 'Please enter a valid email address' }
  ]
};
