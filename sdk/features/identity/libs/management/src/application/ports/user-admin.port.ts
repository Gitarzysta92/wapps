import { Result } from '@sdk/kernel/standard';
import { UserUpdateDto } from '../models/user-update.dto';

export class CredentialInputError extends Error {}
export class CredentialUnavailable extends Error {}

export interface IUserAdminPort {
  updateUser(
    uid: string,
    patch: UserUpdateDto
  ): Promise<Result<boolean, Error>>;
  revokeRefreshTokens(uid: string): Promise<Result<boolean, Error>>;
  deleteUser(uid: string): Promise<Result<boolean, Error>>;

  generatePasswordResetLink(
    uid: string,
    email: string
  ): Promise<Result<string, Error>>;
  generateEmailVerificationLink(
    uid: string,
    email: string
  ): Promise<Result<string, Error>>;
}
