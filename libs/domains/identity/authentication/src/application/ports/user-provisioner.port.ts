import { Result } from '@foundation/standard';

export type ProvisionedUserDto = {
  uid: string;
};

export type CreateUserDto = {
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified?: boolean;
};

export interface IUserProvisioner {
  getUserByEmail(email: string): Promise<Result<ProvisionedUserDto, Error>>;
  createUser(data: CreateUserDto): Promise<Result<ProvisionedUserDto, Error>>;
  createCustomToken(uid: string): Promise<Result<string, Error>>;
}

