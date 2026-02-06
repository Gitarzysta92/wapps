export type ProviderId = string; // e.g. "google.com", "github.com", "password"

export type UserUpdateDto = {
  email?: string;
  password?: string;
  disabled?: boolean;
  providersToUnlink?: ProviderId[];
};

