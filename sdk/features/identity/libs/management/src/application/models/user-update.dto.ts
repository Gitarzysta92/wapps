export type UserUpdateDto = {
  disabled?: boolean;
  email?: string;
  password?: string;
  providersToUnlink?: string[];
};

